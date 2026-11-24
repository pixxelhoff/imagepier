import { defaults, getAssetMetadata, updateAssetMetadata, updateBulkAssetMetadata } from '@immich/sdk';

/**
ImagePier usage rights, stored in Immich's asset metadata under USAGE_RIGHTS_KEY.
Keep in sync with server/src/imagepier/usage-rights.ts.
*/
export const USAGE_RIGHTS_KEY = 'imagepier.usage-rights';
export const USAGE_RIGHTS_VERSION = 1;

export const LICENSE_TYPES = ['owned', 'time-limited', 'agency', 'creative-commons', 'other'] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];

/** Channel ids; the channels are configured by administrators (see getChannels). */
export type PermittedUsage = string;

/** `gallery`: assets permitted for this channel appear in website galleries. */
export type Channel = { id: string; label: string; active: boolean; gallery: boolean };

/** Value of a channel for an asset: permitted, not permitted or permitted under conditions. */
export const CHANNEL_VALUES = ['yes', 'no', 'conditional'] as const;
export type ChannelValue = (typeof CHANNEL_VALUES)[number];

const CHANNEL_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

const toChannelIds = (value: unknown, exclude: string[] = []) => {
  const ids = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && CHANNEL_ID.test(item))
    : [];
  const unique = ids.filter((id, index) => ids.indexOf(id) === index && !exclude.includes(id));
  return unique.length > 0 ? unique : undefined;
};

/**
Release status: `suggested` = in review, `confirmed` = approved, `restricted` = approved with restrictions,
`blocked` = no download, sharing or publishing. Expired follows from `validUntil`.
*/
export const RELEASE_STATUSES = ['suggested', 'confirmed', 'restricted', 'blocked'] as const;
export type UsageRightsStatus = (typeof RELEASE_STATUSES)[number];

/** Scope of the rights; keep in sync with server/src/imagepier/usage-rights.ts. */
export const TERRITORIES = ['worldwide', 'eu', 'germany', 'regional'] as const;
export type Territory = (typeof TERRITORIES)[number];
export const EDITING_OPTIONS = ['yes', 'crop', 'no'] as const;
export type Editing = (typeof EDITING_OPTIONS)[number];
export const TRANSFER_OPTIONS = ['yes', 'conditional', 'no'] as const;
export type Transfer = (typeof TRANSFER_OPTIONS)[number];
/** Additional checks: an entry means the check applies; `cleared` means it has been clarified. */
export const RIGHTS_CHECKS = ['people', 'minors', 'works', 'drone', 'property'] as const;
export type RightsCheck = (typeof RIGHTS_CHECKS)[number];
export type RightsCheckState = 'open' | 'cleared';

export interface UsageRights {
  version: number;
  status: UsageRightsStatus;
  suggestedFrom?: string[];
  photographer?: string;
  copyrightHolder?: string;
  licenseType?: LicenseType;
  licenseSource?: string;
  permittedUsage?: PermittedUsage[];
  conditionalUsage?: PermittedUsage[];
  /** Conditions for the channels permitted under conditions. */
  usageNote?: string;
  /** ISO date (YYYY-MM-DD) */
  validUntil?: string;
  creditLine?: string;
  notes?: string;
  /** What the restriction of the status `restricted` is. */
  restriction?: string;
  title?: string;
  altText?: string;
  /** Link or path to the contract, model release or other rights document. */
  rightsDocument?: string;
  territory?: Territory;
  territoryNote?: string;
  editing?: Editing;
  transfer?: Transfer;
  exclusive?: boolean;
  checks?: Partial<Record<RightsCheck, RightsCheckState>>;
}

const toChecks = (value: unknown) => {
  const record = (value ?? {}) as Record<string, unknown>;
  const checks: Partial<Record<RightsCheck, RightsCheckState>> = {};
  for (const check of RIGHTS_CHECKS) {
    if (record[check] === 'open' || record[check] === 'cleared') {
      checks[check] = record[check];
    }
  }
  return Object.keys(checks).length > 0 ? checks : undefined;
};

/** Usage rights entered in the dialog; without status (several assets) the status of each asset is kept. */
export type UsageRightsInput = Omit<UsageRights, 'status'> & {
  status?: UsageRightsStatus;
  /** Channels set in the dialog; channels that are missing keep their value. */
  channels?: Record<string, ChannelValue>;
  /** Additional checks set in the dialog (`none` = does not apply); checks that are missing keep their value. */
  checkValues?: Partial<Record<RightsCheck, CheckValue>>;
};

export type CheckValue = 'none' | RightsCheckState;
export const CHECK_VALUES: CheckValue[] = ['none', 'open', 'cleared'];

/** Applies the additional checks set in the dialog. */
export const applyChecks = <T extends Partial<UsageRights>>(
  rights: T,
  values?: Partial<Record<RightsCheck, CheckValue>>,
): T => {
  if (!values) {
    return rights;
  }
  const checks: Partial<Record<RightsCheck, RightsCheckState>> = {};
  for (const check of RIGHTS_CHECKS) {
    const value = values[check] ?? rights.checks?.[check];
    if (value && value !== 'none') {
      checks[check] = value;
    }
  }
  return { ...rights, checks };
};

const text = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined);

/** Validates and normalizes a stored value; unknown fields and invalid entries are dropped. */
export const normalizeUsageRights = (value: Record<string, unknown>): UsageRights => {
  const licenseType = LICENSE_TYPES.find((type) => type === value.licenseType);
  const permittedUsage = toChannelIds(value.permittedUsage);
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
    permittedUsage,
    conditionalUsage: toChannelIds(value.conditionalUsage, permittedUsage),
    usageNote: text(value.usageNote),
    validUntil: validUntil && /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : undefined,
    creditLine: text(value.creditLine),
    notes: text(value.notes),
    restriction: status === 'restricted' ? text(value.restriction) : undefined,
    title: text(value.title),
    altText: text(value.altText),
    rightsDocument: text(value.rightsDocument),
    territory: TERRITORIES.find((item) => item === value.territory),
    territoryNote: text(value.territoryNote),
    editing: EDITING_OPTIONS.find((item) => item === value.editing),
    transfer: TRANSFER_OPTIONS.find((item) => item === value.transfer),
    exclusive: typeof value.exclusive === 'boolean' ? value.exclusive : undefined,
    checks: toChecks(value.checks),
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

/**
Asks the server which of the given assets the user may not download (blocked assets, areas without download level).
Without a signed-in user (shared links) or when the check fails, the download is left to the server.
*/
export const getDeniedDownloads = async (assetIds: string[]): Promise<string[]> => {
  try {
    const response = await imagePierRequest('/usage-rights/download-check', {
      method: 'POST',
      body: JSON.stringify({ assetIds }),
    });
    const result = (await response.json()) as { deniedAssetIds?: string[] };
    return result.deniedAssetIds ?? [];
  } catch {
    return [];
  }
};

let channelsPromise: Promise<Channel[]> | undefined;

/** The channel list, including deactivated channels (still shown for assets that use them). */
export const getChannels = () => {
  channelsPromise ??= imagePierRequest('/usage-rights/channels')
    .then((response) => response.json() as Promise<{ channels: Channel[] }>)
    .then(({ channels }) => channels)
    .catch((error: unknown) => {
      channelsPromise = undefined;
      throw error;
    });
  return channelsPromise;
};

export const updateChannelsAdmin = async (channels: Array<Partial<Channel>>): Promise<Channel[]> => {
  const response = await fetch(`${defaults.baseUrl}/admin/imagepier/channels`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...defaults.headers },
    body: JSON.stringify({ channels }),
  });
  if (!response.ok) {
    throw new Error(`ImagePier request failed: ${response.status} ${response.statusText}`);
  }
  const result = (await response.json()) as { channels: Channel[] };
  channelsPromise = Promise.resolve(result.channels);
  return result.channels;
};

export const getChannelLabel = (channels: Channel[], id: string) =>
  channels.find((channel) => channel.id === id)?.label ?? id;

export const getChannelValue = (rights: Partial<UsageRights> | undefined, id: string): ChannelValue => {
  if (rights?.permittedUsage?.includes(id)) {
    return 'yes';
  }
  return rights?.conditionalUsage?.includes(id) ? 'conditional' : 'no';
};

/** Applies the channel values set in the dialog to permitted and conditional channels. */
export const applyChannels = <T extends Partial<UsageRights>>(
  rights: T,
  channels?: Record<string, ChannelValue>,
): T => {
  if (!channels) {
    return rights;
  }
  const changed = Object.keys(channels);
  const keep = (ids?: string[]) => (ids ?? []).filter((id) => !changed.includes(id));
  return {
    ...rights,
    permittedUsage: [...keep(rights.permittedUsage), ...changed.filter((id) => channels[id] === 'yes')],
    conditionalUsage: [...keep(rights.conditionalUsage), ...changed.filter((id) => channels[id] === 'conditional')],
  };
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
  'usageNote',
  'title',
  'altText',
  'rightsDocument',
  'territoryNote',
] as const;

/** Keeps only the fields that were filled in, so empty fields leave existing values unchanged. */
export const toUsageRightsPatch = (rights: UsageRightsInput): Partial<UsageRightsInput> => {
  const patch: Partial<UsageRightsInput> = {};
  for (const key of TEXT_FIELDS) {
    const value = rights[key]?.trim();
    if (value) {
      patch[key] = value;
    }
  }
  if (rights.licenseType) {
    patch.licenseType = rights.licenseType;
  }
  if (rights.channels && Object.keys(rights.channels).length > 0) {
    patch.channels = rights.channels;
  }
  if (rights.status) {
    patch.status = rights.status;
  }
  if (rights.territory) {
    patch.territory = rights.territory;
  }
  if (rights.editing) {
    patch.editing = rights.editing;
  }
  if (rights.transfer) {
    patch.transfer = rights.transfer;
  }
  if (rights.exclusive !== undefined) {
    patch.exclusive = rights.exclusive;
  }
  if (rights.checkValues && Object.keys(rights.checkValues).length > 0) {
    patch.checkValues = rights.checkValues;
  }
  return patch;
};

const BULK_CHUNK_SIZE = 20;

/** Merges a patch into the usage rights of many assets; without a status in the patch the status is kept. */
export const applyUsageRightsToAssets = async (
  assetIds: string[],
  { channels, checkValues, ...patch }: Partial<UsageRightsInput>,
) => {
  for (let index = 0; index < assetIds.length; index += BULK_CHUNK_SIZE) {
    const chunk = assetIds.slice(index, index + BULK_CHUNK_SIZE);
    const existing = await Promise.all(chunk.map((assetId) => loadUsageRights(assetId)));
    const items = chunk.map((assetId, position) => ({
      assetId,
      key: USAGE_RIGHTS_KEY,
      value: compact(
        normalizeUsageRights({
          ...applyChecks(applyChannels({ ...existing[position] }, channels), checkValues),
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
