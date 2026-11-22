/**
ImagePier roles and access rules.

- Every area (department) has a technical account that owns its media. The area of a media library asset is the area
  of its owner. The account of the shared area is the original media library account (`libraryUserId`).
- Each area account is shared (Immich partner sharing) with the users who have a level in the area, so timeline,
  search, map and mobile apps only show the areas a user has access to.
- Roles extend Immich's admin flag:
  - admin: everything (Immich admins)
  - staff: employees
  - external: e.g. photographers or agencies
- Access to areas is granted per user and area with a level:
  - viewer: view assets and add them to own albums
  - standard: viewer + download
  - editor: standard + upload into the area, maintain usage rights, trash and restore
  - manager: editor + permanent deletion and confirming usage rights (staff only)
- Without a level an area is not accessible. Own assets are not affected by these rules.

The settings are stored in Immich's system metadata under `ACCESS_SETTINGS_KEY` and cached in memory,
because they are needed for every access check.
*/

export const ACCESS_SETTINGS_KEY = 'imagepier.access';

export const ROLES = ['admin', 'staff', 'external'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that can be stored per account; admin follows Immich's admin flag. */
export const ASSIGNABLE_ROLES = ['staff', 'external'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Access levels per area, from lowest to highest. */
export const AREA_LEVELS = ['viewer', 'standard', 'editor', 'manager'] as const;
export type AreaLevel = (typeof AREA_LEVELS)[number];

/** Area that existed before areas were introduced; assets without an area belong to it. */
export const SHARED_AREA_ID = 'shared';

/** Asset metadata key that also stores the area of a media library asset (the owner decides). */
export const ASSET_AREA_KEY = 'imagepier.area';

export type Area = {
  id: string;
  name: string;
  /** Technical account that owns the assets of the area */
  userId?: string;
};

export type StoredUserAccess = {
  role?: AssignableRole;
  /** Level per area id */
  areas?: Record<string, AreaLevel>;
};

export type AccessSettings = {
  /** Account of the shared area; the media library rules are active once it exists. */
  libraryUserId?: string;
  /** Whether assets of earlier versions were moved to the accounts of their areas. */
  areaAssetsMigrated?: boolean;
  areas: Area[];
  users: Record<string, StoredUserAccess>;
};

export type UserAccess = {
  role: Role;
  /** Level per area id; areas without access are missing. */
  areas: Record<string, AreaLevel>;
  /** Whether the user can see at least one area. */
  canViewLibrary: boolean;
  /** Whether the user is editor or media manager in at least one area. */
  canEditLibrary: boolean;
};

const asText = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined);

const isAreaLevel = (value: unknown): value is AreaLevel => (AREA_LEVELS as readonly unknown[]).includes(value);

/** Whether a level includes the rights of another level. */
export const isAtLeast = (level: AreaLevel | undefined, minimum: AreaLevel) =>
  !!level && AREA_LEVELS.indexOf(level) >= AREA_LEVELS.indexOf(minimum);

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
      areas.push({ id, name, userId: asText(entry.userId) });
    }
  }
  if (areas.every((area) => area.id !== SHARED_AREA_ID)) {
    areas.unshift({ id: SHARED_AREA_ID, name: sharedAreaName });
  }

  // The shared area always uses the original media library account.
  const libraryUserId = asText(record.libraryUserId);
  for (const area of areas) {
    if (area.id === SHARED_AREA_ID) {
      area.userId = libraryUserId;
    }
  }

  return { libraryUserId, areaAssetsMigrated: record.areaAssetsMigrated === true, areas, users };
};

/** Area id per area account. */
export const getAreaAccounts = (settings: AccessSettings) =>
  new Map(settings.areas.flatMap((area) => (area.userId ? [[area.userId, area.id] as const] : [])));

/** Area that owns assets of the given account, or undefined for regular users. */
export const getAreaOfOwner = (settings: AccessSettings, ownerId: string) =>
  settings.areas.find((area) => !!area.userId && area.userId === ownerId);

/**
Reads the stored access of one user.
Settings of earlier versions are converted: the former role "manager" becomes staff with the level manager in the
areas the user was responsible for.
*/
export const parseStoredUserAccess = (value: unknown): StoredUserAccess => {
  const record = (value ?? {}) as Record<string, unknown>;
  const role = record.role === 'manager' ? 'staff' : ASSIGNABLE_ROLES.find((item) => item === record.role);

  const areas: Record<string, AreaLevel> = {};
  if (Array.isArray(record.areas)) {
    if (record.role === 'manager') {
      for (const areaId of record.areas) {
        if (typeof areaId === 'string') {
          areas[areaId] = 'manager';
        }
      }
    }
  } else if (record.areas && typeof record.areas === 'object') {
    for (const [areaId, level] of Object.entries(record.areas as Record<string, unknown>)) {
      if (isAreaLevel(level)) {
        // Externals cannot be media managers.
        areas[areaId] = role === 'external' && level === 'manager' ? 'editor' : level;
      }
    }
  }

  return { role, areas: Object.keys(areas).length > 0 ? areas : undefined };
};

/** Reads the area id stored in the asset metadata. */
export const parseAssetArea = (value: unknown) => asText((value as { areaId?: unknown } | undefined)?.areaId);

export const getUserAccess = (settings: AccessSettings, user: { id: string; isAdmin: boolean }): UserAccess => {
  // Admins have full access. Without a media library account the rules are not active and Immich's behaviour applies.
  if (user.isAdmin || !settings.libraryUserId) {
    return {
      role: user.isAdmin ? 'admin' : 'staff',
      areas: Object.fromEntries(settings.areas.map((area) => [area.id, 'manager' as const])),
      canViewLibrary: true,
      canEditLibrary: user.isAdmin,
    };
  }

  const stored = settings.users[user.id] ?? {};
  const role = stored.role ?? 'staff';
  const areas: Record<string, AreaLevel> = {};
  for (const area of settings.areas) {
    const level = stored.areas?.[area.id];
    if (level) {
      areas[area.id] = level;
    }
  }
  const levels = Object.values(areas);

  return {
    role,
    areas,
    canViewLibrary: levels.length > 0,
    canEditLibrary: levels.some((level) => isAtLeast(level, 'editor')),
  };
};

/** Level of a user in an area; assets without area belong to the shared area. */
export const getAreaLevel = (access: UserAccess, areaId: string | undefined) => access.areas[areaId ?? SHARED_AREA_ID];

/** Whether a user may download assets of the given area. */
export const canDownloadArea = (access: UserAccess, areaId: string | undefined) =>
  isAtLeast(getAreaLevel(access, areaId), 'standard');

/** Whether a user may upload into, edit and trash assets of the given area. */
export const canEditArea = (access: UserAccess, areaId: string | undefined) =>
  isAtLeast(getAreaLevel(access, areaId), 'editor');

/** Whether a user may permanently delete assets of the given area and confirm usage rights. */
export const canManageArea = (access: UserAccess, areaId: string | undefined) =>
  isAtLeast(getAreaLevel(access, areaId), 'manager');

/** In-memory copy of the settings, kept up to date by the ImagePier access service. */
let cachedSettings: AccessSettings = { areas: [], users: {} };

/** Name of the shared area until an administrator renames it. */
export const getSharedAreaName = () =>
  (process.env.IMAGEPIER_LANGUAGE ?? 'en').toLowerCase().startsWith('de') ? 'Allgemein' : 'General';

export const getCachedAccessSettings = () => cachedSettings;

export const setCachedAccessSettings = (settings: AccessSettings) => {
  cachedSettings = settings;
};
