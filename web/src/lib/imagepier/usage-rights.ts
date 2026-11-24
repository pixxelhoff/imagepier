import { defaults, getAssetMetadata, updateAssetMetadata, updateBulkAssetMetadata } from '@immich/sdk';

/**
ImagePier usage rights, stored in Immich's asset metadata under USAGE_RIGHTS_KEY.
Keep in sync with server/src/imagepier/usage-rights.ts.
*/
export const USAGE_RIGHTS_KEY = 'imagepier.usage-rights';
export const USAGE_RIGHTS_VERSION = 1;

export const LICENSE_TYPES = ['owned', 'time-limited', 'agency', 'creative-commons', 'other'] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];

export const PERMITTED_USAGES = ['internal', 'web', 'print', 'social', 'press'] as const;
export type PermittedUsage = (typeof PERMITTED_USAGES)[number];

/**
Release status: `suggested` = in review, `confirmed` = approved, `restricted` = approved with restrictions,
`blocked` = no download, sharing or publishing. Expired follows from `validUntil`.
*/
export const RELEASE_STATUSES = ['suggested', 'confirmed', 'restricted', 'blocked'] as const;
export type UsageRightsStatus = (typeof RELEASE_STATUSES)[number];

export interface UsageRights {
  version: number;
  status: UsageRightsStatus;
  suggestedFrom?: string[];
  photographer?: string;
  copyrightHolder?: string;
  licenseType?: LicenseType;
  licenseSource?: string;
  permittedUsage?: PermittedUsage[];
  /** ISO date (YYYY-MM-DD) */
  validUntil?: string;
  creditLine?: string;
  notes?: string;
  /** What the restriction of the status `restricted` is. */
  restriction?: string;
}

/** Usage rights entered in the dialog; without status (several assets) the status of each asset is kept. */
export type UsageRightsInput = Omit<UsageRights, 'status'> & { status?: UsageRightsStatus };

const text = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined);

/** Validates and normalizes a stored value; unknown fields and invalid entries are dropped. */
export const normalizeUsageRights = (value: Record<string, unknown>): UsageRights => {
  const licenseType = LICENSE_TYPES.find((type) => type === value.licenseType);
  const permittedUsage = Array.isArray(value.permittedUsage)
    ? PERMITTED_USAGES.filter((usage) => (value.permittedUsage as unknown[]).includes(usage))
    : [];
  const validUntil = text(value.validUntil);
  const status = RELEASE_STATUSES.find((item) => item === value.status) ?? 'suggested';

  return {
    version: USAGE_RIGHTS_VERSION,
    status,
    suggestedFrom: Array.isArray(value.suggestedFrom)
      ? value.suggestedFrom.filter((item) => typeof item === 'string')
      : undefined,
    photographer: text(value.photographer),
    copyrightHolder: text(value.copyrightHolder),
    licenseType,
    licenseSource: text(value.licenseSource),
    permittedUsage: permittedUsage.length > 0 ? permittedUsage : undefined,
    validUntil: validUntil && /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : undefined,
    creditLine: text(value.creditLine),
    notes: text(value.notes),
    restriction: status === 'restricted' ? text(value.restriction) : undefined,
  };
};

export type UsageRightsConfig = {
  tags: {
    root: string;
    photographer: string;
    copyrightHolder: string;
    license: string;
    status: string;
    usage: string;
    licenseSource: string;
    creditLine: string;
    validUntil: string;
    missing: string;
    area: string;
  };
  statuses: Record<'valid' | 'restricted' | 'expiring' | 'expired' | 'blocked' | 'unreviewed', string>;
  missing: Record<'copyrightHolder' | 'photographer' | 'license', string>;
  expiringSoonDays: number;
};

const imagePierRequest = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${defaults.baseUrl}/imagepier${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...defaults.headers },
  });
  if (!response.ok) {
    throw new Error(`ImagePier request failed: ${response.status} ${response.statusText}`);
  }
  return response;
};

/** Updates the usage rights tags (used for search) of the given assets. */
/** Updates the usage rights tags; `confirmed` marks a confirmation by a media manager in the audit log. */
export const syncUsageRightsTags = async (assetIds: string[], confirmed = false) => {
  await imagePierRequest('/usage-rights/sync', { method: 'POST', body: JSON.stringify({ assetIds, confirmed }) });
};

let configPromise: Promise<UsageRightsConfig> | undefined;

export const getUsageRightsConfig = () => {
  configPromise ??= imagePierRequest('/usage-rights/config')
    .then((response) => response.json() as Promise<UsageRightsConfig>)
    .catch((error: unknown) => {
      configPromise = undefined;
      throw error;
    });
  return configPromise;
};

/** Removes undefined fields so the stored JSON stays compact. */
const compact = (rights: UsageRights) =>
  Object.fromEntries(Object.entries(rights).filter(([, value]) => value !== undefined)) as Record<string, unknown>;

export const isBlocked = (rights: UsageRights | undefined) => rights?.status === 'blocked';

export const isExpired = (rights: UsageRights | undefined, today = new Date().toISOString().slice(0, 10)) =>
  !!rights?.validUntil && rights.validUntil < today;

export const loadUsageRights = async (assetId: string): Promise<UsageRights | undefined> => {
  const items = await getAssetMetadata({ id: assetId });
  const item = items.find(({ key }) => key === USAGE_RIGHTS_KEY);
  return item ? normalizeUsageRights(item.value) : undefined;
};

/** Asset metadata keys of the media library; keep in sync with server/src/imagepier/access-rules.ts. */
export const ASSET_AREA_KEY = 'imagepier.area';
export const UPLOADED_BY_KEY = 'imagepier.uploaded-by';

/** Usage rights, media library area and the person who added an asset, read with a single request. */
export const loadAssetDetails = async (assetId: string) => {
  const items = await getAssetMetadata({ id: assetId });
  const rights = items.find(({ key }) => key === USAGE_RIGHTS_KEY);
  const areaId = items.find(({ key }) => key === ASSET_AREA_KEY)?.value.areaId;
  const uploadedBy = items.find(({ key }) => key === UPLOADED_BY_KEY)?.value.userId;
  return {
    rights: rights ? normalizeUsageRights(rights.value) : undefined,
    areaId: typeof areaId === 'string' ? areaId : undefined,
    uploadedBy: typeof uploadedBy === 'string' ? uploadedBy : undefined,
  };
};

/** Saves usage rights; the server keeps them "in review" if the user may not decide the release status. */
export const saveUsageRights = async (assetId: string, rights: UsageRights): Promise<UsageRights> => {
  const value = compact(normalizeUsageRights({ ...rights, suggestedFrom: undefined }));
  const items = await updateAssetMetadata({
    id: assetId,
    assetMetadataUpsertDto: { items: [{ key: USAGE_RIGHTS_KEY, value }] },
  });
  await syncUsageRightsTags([assetId]);
  const saved = items.find(({ key }) => key === USAGE_RIGHTS_KEY);
  return normalizeUsageRights(saved?.value ?? value);
};

const TEXT_FIELDS = [
  'photographer',
  'copyrightHolder',
  'licenseSource',
  'creditLine',
  'notes',
  'validUntil',
  'restriction',
] as const;

/** Keeps only the fields that were filled in, so empty fields leave existing values unchanged. */
export const toUsageRightsPatch = (rights: UsageRightsInput): Partial<UsageRights> => {
  const patch: Partial<UsageRights> = {};
  for (const key of TEXT_FIELDS) {
    const value = rights[key]?.trim();
    if (value) {
      patch[key] = value;
    }
  }
  if (rights.licenseType) {
    patch.licenseType = rights.licenseType;
  }
  if (rights.permittedUsage?.length) {
    patch.permittedUsage = rights.permittedUsage;
  }
  if (rights.status) {
    patch.status = rights.status;
  }
  return patch;
};

const BULK_CHUNK_SIZE = 20;

/** Merges a patch into the usage rights of many assets; without a status in the patch the status is kept. */
export const applyUsageRightsToAssets = async (assetIds: string[], patch: Partial<UsageRights>) => {
  for (let index = 0; index < assetIds.length; index += BULK_CHUNK_SIZE) {
    const chunk = assetIds.slice(index, index + BULK_CHUNK_SIZE);
    const existing = await Promise.all(chunk.map((assetId) => loadUsageRights(assetId)));
    const items = chunk.map((assetId, position) => ({
      assetId,
      key: USAGE_RIGHTS_KEY,
      value: compact(
        normalizeUsageRights({
          ...existing[position],
          ...patch,
          status: patch.status ?? existing[position]?.status ?? 'suggested',
          suggestedFrom: undefined,
        }),
      ),
    }));
    await updateBulkAssetMetadata({ assetMetadataBulkUpsertDto: { items } });
    await syncUsageRightsTags(chunk);
  }
};

/**
Confirms the usage rights of the given assets; assets without usage rights are skipped.
The server only accepts this from admins, media managers of the area and owners of the assets.
*/
export const confirmUsageRights = async (assetIds: string[]) => {
  let count = 0;
  for (let index = 0; index < assetIds.length; index += BULK_CHUNK_SIZE) {
    const chunk = assetIds.slice(index, index + BULK_CHUNK_SIZE);
    const existing = await Promise.all(chunk.map((assetId) => loadUsageRights(assetId)));
    const items = chunk
      .map((assetId, position) => ({ assetId, rights: existing[position] }))
      .filter(({ rights }) => rights?.status === 'suggested')
      .map(({ assetId, rights }) => ({
        assetId,
        key: USAGE_RIGHTS_KEY,
        value: compact(normalizeUsageRights({ ...rights, status: 'confirmed', suggestedFrom: undefined })),
      }));
    if (items.length === 0) {
      continue;
    }

    const saved = await updateBulkAssetMetadata({ assetMetadataBulkUpsertDto: { items } });
    await syncUsageRightsTags(
      items.map((item) => item.assetId),
      true,
    );
    count += saved.filter((item) => item.value.status === 'confirmed').length;
  }
  return count;
};
