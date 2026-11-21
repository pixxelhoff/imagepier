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

The settings are stored in Immich's system metadata under `ACCESS_SETTINGS_KEY` and cached in memory,
because they are needed for every access check.
*/

export const ACCESS_SETTINGS_KEY = 'imagepier.access';

export const ROLES = ['admin', 'manager', 'staff', 'external'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that can be stored per account; admin follows Immich's admin flag. */
export const ASSIGNABLE_ROLES = ['manager', 'staff', 'external'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type StoredUserAccess = {
  role?: AssignableRole;
  canUpload?: boolean;
  canDownload?: boolean;
};

export type AccessSettings = {
  libraryUserId?: string;
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
};

export const parseAccessSettings = (value: unknown): AccessSettings => {
  const record = (value ?? {}) as Partial<AccessSettings>;
  const users: Record<string, StoredUserAccess> = {};
  for (const [userId, item] of Object.entries(record.users ?? {})) {
    users[userId] = parseStoredUserAccess(item);
  }

  return {
    libraryUserId: typeof record.libraryUserId === 'string' ? record.libraryUserId : undefined,
    users,
  };
};

export const parseStoredUserAccess = (value: unknown): StoredUserAccess => {
  const record = (value ?? {}) as Record<string, unknown>;
  return {
    role: ASSIGNABLE_ROLES.find((role) => role === record.role),
    canUpload: typeof record.canUpload === 'boolean' ? record.canUpload : undefined,
    canDownload: typeof record.canDownload === 'boolean' ? record.canDownload : undefined,
  };
};

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
  };
};

/** In-memory copy of the settings, kept up to date by the ImagePier access service. */
let cachedSettings: AccessSettings = { users: {} };

export const getCachedAccessSettings = () => cachedSettings;

export const setCachedAccessSettings = (settings: AccessSettings) => {
  cachedSettings = settings;
};
