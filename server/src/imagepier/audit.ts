import type { AuthDto } from 'src/dtos/auth.dto.js';

/**
Audit log of ImagePier.

Other parts of ImagePier and the hooks in Immich's services report actions with `recordAudit()`.
The audit service registers itself as sink and stores the entries; without a sink (unit tests) nothing happens.
*/

export const AUDIT_SETTINGS_KEY = 'imagepier.audit';
export const AUDIT_TABLE = 'imagepier_audit';

export const AUDIT_ACTIONS = [
  'upload',
  'download',
  'usage_rights',
  'usage_rights_confirm',
  'library_move',
  'trash',
  'restore',
  'delete',
  'access',
  'areas',
  'user_create',
  'user_delete',
  'login',
  'gallery',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditSettings = {
  /** Entries older than this are removed every night. */
  retentionDays: number;
  /** Store who downloaded an asset; otherwise downloads are only counted. */
  downloadsWithUser: boolean;
  /** Store logins. */
  logins: boolean;
};

export const DEFAULT_AUDIT_SETTINGS: AuditSettings = { retentionDays: 365, downloadsWithUser: false, logins: false };

export const MIN_RETENTION_DAYS = 1;
export const MAX_RETENTION_DAYS = 3650;

/** Asset IDs stored per entry; the count is always stored in full. */
export const MAX_AUDIT_ASSET_IDS = 1000;

export type AuditEntry = {
  action: AuditAction;
  userId?: string | null;
  userName?: string | null;
  assetIds?: string[];
  details?: Record<string, unknown>;
};

export const parseAuditSettings = (value: unknown): AuditSettings => {
  const record = (value ?? {}) as Partial<AuditSettings>;
  const days = Number(record.retentionDays);
  return {
    retentionDays: Number.isSafeInteger(days)
      ? Math.min(Math.max(days, MIN_RETENTION_DAYS), MAX_RETENTION_DAYS)
      : DEFAULT_AUDIT_SETTINGS.retentionDays,
    downloadsWithUser: record.downloadsWithUser === true,
    logins: record.logins === true,
  };
};

/**
Applies the audit settings to an entry: returns undefined if the entry is not stored,
and removes the person from downloads unless the administrator enabled it.
*/
export const applyAuditSettings = (entry: AuditEntry, settings: AuditSettings): AuditEntry | undefined => {
  if (entry.action === 'login' && !settings.logins) {
    return;
  }

  const assetIds = entry.assetIds ?? [];
  const limited = { ...entry, assetIds: assetIds.slice(0, MAX_AUDIT_ASSET_IDS) };
  if (entry.action === 'download' && !settings.downloadsWithUser) {
    return { ...limited, userId: null, userName: null };
  }
  return limited;
};

export type AuditSink = (entry: AuditEntry) => void;

let auditSink: AuditSink | undefined;

/** Registered by the audit service. */
export const setAuditSink = (sink: AuditSink | undefined) => {
  auditSink = sink;
};

/** Reports an action; never throws and never waits for the database. */
export const recordAudit = (entry: AuditEntry) => {
  auditSink?.(entry);
};

const actor = (auth: AuthDto) => ({ userId: auth.user.id, userName: auth.user.name });

/** Reports an action of the signed-in user. */
export const recordAuditFor = (auth: AuthDto, entry: Omit<AuditEntry, 'userId' | 'userName'>) => {
  recordAudit({ ...entry, ...actor(auth) });
};

/** Reports a download; `kind` is "original" for single files and "archive" for ZIP downloads. */
export const recordDownload = (auth: AuthDto, assetIds: string[], kind: 'original' | 'archive') => {
  recordAuditFor(auth, { action: 'download', assetIds, details: { kind, sharedLink: !!auth.sharedLink } });
};

/** Reports a login; stored only if the administrator enabled login logging. */
export const recordLogin = (
  user: { id: string; name: string },
  details: { deviceType?: string | null; deviceOS?: string | null },
) => {
  recordAudit({
    action: 'login',
    userId: user.id,
    userName: user.name,
    details: { deviceType: details.deviceType ?? null, deviceOS: details.deviceOS ?? null },
  });
};
