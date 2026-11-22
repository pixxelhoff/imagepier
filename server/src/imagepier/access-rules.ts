/**
ImagePier roles and access rules.

- A technical "media library" account owns all official media. Its assets are shared with all
  non-external users through Immich's partner sharing (read + download).
- Roles extend Immich's admin flag:
  - admin: everything (Immich admins)
  - manager: upload, edit and trash media library assets
  - staff: read + download, upload only if enabled per account
  - external: no media library access, only shared albums and links; download only if enabled
- Permanently deleting assets is reserved for admins.
- Media library assets belong to an area (department). Media managers can only edit assets of their own areas and
  of the shared area; assets without an area count as shared.

The settings are stored in Immich's system metadata under `ACCESS_SETTINGS_KEY` and cached in memory,
because they are needed for every access check.
*/

export const ACCESS_SETTINGS_KEY = 'imagepier.access';

export const ROLES = ['admin', 'manager', 'staff', 'external'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that can be stored per account; admin follows Immich's admin flag. */
export const ASSIGNABLE_ROLES = ['manager', 'staff', 'external'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Area for media used across departments; always exists. */
export const SHARED_AREA_ID = 'shared';

/** Asset metadata key that stores the area of a media library asset. */
export const ASSET_AREA_KEY = 'imagepier.area';

export type Area = { id: string; name: string };

export type StoredUserAccess = {
  role?: AssignableRole;
  canUpload?: boolean;
  canDownload?: boolean;
  /** Areas a media manager is responsible for */
  areas?: string[];
};

export type AccessSettings = {
  libraryUserId?: string;
  areas: Area[];
  users: Record<string, StoredUserAccess>;
};

export type UserAccess = {
  role: Role;
  canUpload: boolean;
  canDownload: boolean;
  /** Whether the user can see the media library. */
  canViewLibrary: boolean;
  /** Whether the user can edit and trash media library assets. */
  canEditLibrary: boolean;
  /** Whether the user can permanently delete assets. */
  canDeletePermanently: boolean;
  /** Areas the user is responsible for (media managers) */
  areas: string[];
};

const asText = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined);

export const parseAccessSettings = (value: unknown, sharedAreaName = 'Shared'): AccessSettings => {
  const record = (value ?? {}) as Partial<AccessSettings>;
  const users: Record<string, StoredUserAccess> = {};
  for (const [userId, item] of Object.entries(record.users ?? {})) {
    users[userId] = parseStoredUserAccess(item);
  }

  const areas: Area[] = [];
  const storedAreas: unknown[] = Array.isArray(record.areas) ? record.areas : [];
  for (const item of storedAreas) {
    const entry = (item ?? {}) as Partial<Area>;
    const id = asText(entry.id);
    const name = asText(entry.name);
    if (id && name && areas.every((area) => area.id !== id)) {
      areas.push({ id, name });
    }
  }
  if (areas.every((area) => area.id !== SHARED_AREA_ID)) {
    areas.unshift({ id: SHARED_AREA_ID, name: sharedAreaName });
  }

  return {
    libraryUserId: typeof record.libraryUserId === 'string' ? record.libraryUserId : undefined,
    areas,
    users,
  };
};

export const parseStoredUserAccess = (value: unknown): StoredUserAccess => {
  const record = (value ?? {}) as Record<string, unknown>;
  return {
    role: ASSIGNABLE_ROLES.find((role) => role === record.role),
    canUpload: typeof record.canUpload === 'boolean' ? record.canUpload : undefined,
    canDownload: typeof record.canDownload === 'boolean' ? record.canDownload : undefined,
    areas: Array.isArray(record.areas) ? record.areas.filter((area) => typeof area === 'string') : undefined,
  };
};

/** Reads the area id stored in the asset metadata. */
export const parseAssetArea = (value: unknown) => asText((value as { areaId?: unknown } | undefined)?.areaId);

export const getUserAccess = (settings: AccessSettings, user: { id: string; isAdmin: boolean }): UserAccess => {
  // Without a media library account the rules are not active and Immich's behaviour applies.
  if (user.isAdmin || !settings.libraryUserId) {
    return {
      role: user.isAdmin ? 'admin' : 'staff',
      canUpload: true,
      canDownload: true,
      canViewLibrary: true,
      canEditLibrary: user.isAdmin,
      canDeletePermanently: true,
      areas: settings.areas.map((area) => area.id),
    };
  }

  const stored = settings.users[user.id] ?? {};
  const isLibrary = user.id === settings.libraryUserId;
  const role = stored.role ?? 'staff';

  return {
    role,
    canUpload: isLibrary || (stored.canUpload ?? role === 'manager'),
    canDownload: stored.canDownload ?? role !== 'external',
    canViewLibrary: role !== 'external',
    canEditLibrary: role === 'manager',
    canDeletePermanently: false,
    areas: role === 'manager' ? (stored.areas ?? []) : [],
  };
};

/** Whether a user may edit media library assets of the given area. */
export const canEditArea = (access: UserAccess, areaId: string | undefined) => {
  if (access.role === 'admin') {
    return true;
  }

  if (!access.canEditLibrary) {
    return false;
  }

  return !areaId || areaId === SHARED_AREA_ID || access.areas.includes(areaId);
};

/** In-memory copy of the settings, kept up to date by the ImagePier access service. */
let cachedSettings: AccessSettings = { areas: [], users: {} };

/** Name of the shared area until an administrator renames it. */
export const getSharedAreaName = () =>
  (process.env.IMAGEPIER_LANGUAGE ?? 'en').toLowerCase().startsWith('de') ? 'Übergreifend' : 'Shared';

export const getCachedAccessSettings = () => cachedSettings;

export const setCachedAccessSettings = (settings: AccessSettings) => {
  cachedSettings = settings;
};
