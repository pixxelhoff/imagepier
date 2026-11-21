import { getAssetMetadata, updateAssetMetadata } from '@immich/sdk';

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
  const saved = items.find(({ key }) => key === USAGE_RIGHTS_KEY);
  return normalizeUsageRights(saved?.value ?? value);
};
