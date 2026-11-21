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

export type UsageRightsStatus = 'suggested' | 'confirmed';

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
}

const text = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined);

/** Validates and normalizes a stored value; unknown fields and invalid entries are dropped. */
export const normalizeUsageRights = (value: Record<string, unknown>): UsageRights => {
  const licenseType = LICENSE_TYPES.find((type) => type === value.licenseType);
  const permittedUsage = Array.isArray(value.permittedUsage)
    ? PERMITTED_USAGES.filter((usage) => (value.permittedUsage as unknown[]).includes(usage))
    : [];
  const validUntil = text(value.validUntil);

  return {
    version: USAGE_RIGHTS_VERSION,
    status: value.status === 'confirmed' ? 'confirmed' : 'suggested',
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
  };
  statuses: Record<'valid' | 'expiring' | 'expired' | 'unreviewed', string>;
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
export const syncUsageRightsTags = async (assetIds: string[]) => {
  await imagePierRequest('/usage-rights/sync', { method: 'POST', body: JSON.stringify({ assetIds }) });
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

export const isExpired = (rights: UsageRights | undefined, today = new Date().toISOString().slice(0, 10)) =>
  !!rights?.validUntil && rights.validUntil < today;

export const loadUsageRights = async (assetId: string): Promise<UsageRights | undefined> => {
  const items = await getAssetMetadata({ id: assetId });
  const item = items.find(({ key }) => key === USAGE_RIGHTS_KEY);
  return item ? normalizeUsageRights(item.value) : undefined;
};

export const saveUsageRights = async (assetId: string, rights: UsageRights): Promise<UsageRights> => {
  const value = compact(normalizeUsageRights({ ...rights, status: 'confirmed', suggestedFrom: undefined }));
  const items = await updateAssetMetadata({
    id: assetId,
    assetMetadataUpsertDto: { items: [{ key: USAGE_RIGHTS_KEY, value }] },
  });
  await syncUsageRightsTags([assetId]);
  const saved = items.find(({ key }) => key === USAGE_RIGHTS_KEY);
  return normalizeUsageRights(saved?.value ?? value);
};

const TEXT_FIELDS = ['photographer', 'copyrightHolder', 'licenseSource', 'creditLine', 'notes', 'validUntil'] as const;

/** Keeps only the fields that were filled in, so empty fields leave existing values unchanged. */
export const toUsageRightsPatch = (rights: UsageRights): Partial<UsageRights> => {
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
  return patch;
};

const BULK_CHUNK_SIZE = 20;

/** Merges a patch into the usage rights of many assets and marks them as confirmed. */
export const applyUsageRightsToAssets = async (assetIds: string[], patch: Partial<UsageRights>) => {
  for (let index = 0; index < assetIds.length; index += BULK_CHUNK_SIZE) {
    const chunk = assetIds.slice(index, index + BULK_CHUNK_SIZE);
    const existing = await Promise.all(chunk.map((assetId) => loadUsageRights(assetId)));
    const items = chunk.map((assetId, position) => ({
      assetId,
      key: USAGE_RIGHTS_KEY,
      value: compact(
        normalizeUsageRights({ ...existing[position], ...patch, status: 'confirmed', suggestedFrom: undefined }),
      ),
    }));
    await updateBulkAssetMetadata({ assetMetadataBulkUpsertDto: { items } });
    await syncUsageRightsTags(chunk);
  }
};
