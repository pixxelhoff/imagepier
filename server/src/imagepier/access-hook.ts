import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { Permission } from 'src/enum.js';
import {
  RESERVED_METADATA_KEYS,
  canDownloadArea,
  canEditArea,
  canManageArea,
  getAreaAccounts,
  getAreaLevel,
  getCachedAccessSettings,
  getUserAccess,
} from 'src/imagepier/access-rules.js';
import { USAGE_RIGHTS_KEY, type UsageRightsStatus } from 'src/imagepier/usage-rights.js';
import type { AccessRepository } from 'src/repositories/access.repository.js';

type AccessCheck = { auth: AuthDto; permission: Permission; ids: Set<string> };

/** Returns the owner id of each given asset; unknown assets are missing. */
export type AssetOwnerResolver = (assetIds: string[]) => Promise<Map<string, string>>;

let assetOwnerResolver: AssetOwnerResolver | undefined;

/** Registered by the ImagePier access service, which can read the assets. */
export const setAssetOwnerResolver = (resolver: AssetOwnerResolver | undefined) => {
  assetOwnerResolver = resolver;
};

/** Returns who added each given asset to the media library; assets without that information are missing. */
export type AssetUploaderResolver = (assetIds: string[]) => Promise<Map<string, string>>;

let assetUploaderResolver: AssetUploaderResolver | undefined;

/** Registered by the ImagePier access service, which can read the asset metadata. */
export const setAssetUploaderResolver = (resolver: AssetUploaderResolver | undefined) => {
  assetUploaderResolver = resolver;
};

/** Access for the current user according to the ImagePier role settings. */
/** Returns the release status of each given asset that has usage rights; registered by the usage rights service. */
export type ReleaseStatusResolver = (assetIds: string[]) => Promise<Map<string, UsageRightsStatus>>;

let releaseStatusResolver: ReleaseStatusResolver | undefined;

export const setReleaseStatusResolver = (resolver: ReleaseStatusResolver | undefined) => {
  releaseStatusResolver = resolver;
};

/** Assets among the given ones whose usage rights have the status "blocked". */
export const getBlockedAssets = async (ids: Set<string>) => {
  if (!releaseStatusResolver || ids.size === 0) {
    return new Set<string>();
  }
  const statuses = await releaseStatusResolver([...ids]);
  return new Set([...ids].filter((id) => statuses.get(id) === 'blocked'));
};

/** Blocked assets cannot be opened or downloaded through shared links. */
export const applyImagePierSharedLinkAccess = async (permission: Permission, granted: Promise<Set<string>>) => {
  const allowed = await granted;
  switch (permission) {
    case Permission.AssetRead:
    case Permission.AssetView:
    case Permission.AssetDownload: {
      return allowed.difference(await getBlockedAssets(allowed));
    }
    default: {
      return allowed;
    }
  }
};

export const getAccessForAuth = (auth: AuthDto) => getUserAccess(getCachedAccessSettings(), auth.user);

/** Media library assets (owned by an area account) among the given ids, and those whose area passes the check. */
const checkLibraryAssets = async (ids: Set<string>, isPermitted: (areaId: string) => boolean) => {
  const library = new Set<string>();
  const permitted = new Set<string>();
  const accounts = getAreaAccounts(getCachedAccessSettings());
  if (accounts.size === 0 || ids.size === 0 || !assetOwnerResolver) {
    return { library, permitted };
  }

  for (const [assetId, ownerId] of await assetOwnerResolver([...ids])) {
    const areaId = accounts.get(ownerId);
    if (areaId === undefined || !ids.has(assetId)) {
      continue;
    }
    library.add(assetId);
    if (isPermitted(areaId)) {
      permitted.add(assetId);
    }
  }
  return { library, permitted };
};

/**
Applies the ImagePier area rules on top of Immich's own access checks.
Called from `checkAccess` in `src/utils/access.ts` for all requests that do not use a shared link.
*/
export const applyImagePierAccess = async (
  access: AccessRepository,
  { auth, permission, ids }: AccessCheck,
  granted: Promise<Set<string>>,
): Promise<Set<string>> => {
  const allowed = await granted;
  const userAccess = getAccessForAuth(auth);
  const settings = getCachedAccessSettings();
  if (!settings.libraryUserId) {
    return allowed;
  }

  switch (permission) {
    // Media library assets can be downloaded from areas with the level standard or higher.
    // Blocked media library assets only by media managers of their area.
    case Permission.AssetDownload: {
      if (userAccess.role === 'admin') {
        return allowed;
      }
      const { library, permitted } = await checkLibraryAssets(allowed, (areaId) => canDownloadArea(userAccess, areaId));
      const blocked = await getBlockedAssets(permitted);
      const managed = (await checkLibraryAssets(blocked, (areaId) => canManageArea(userAccess, areaId))).permitted;
      return allowed.difference(library.difference(permitted)).difference(blocked.difference(managed));
    }

    // Editors and media managers edit and trash media library assets of their areas; externals only assets they added.
    case Permission.AssetUpdate:
    case Permission.AssetDelete: {
      const missing = ids.difference(allowed);
      if (!userAccess.canEditLibrary || missing.size === 0) {
        return allowed;
      }
      const { permitted } = await checkLibraryAssets(missing, (areaId) => canEditArea(userAccess, areaId));
      if (userAccess.role !== 'external' || permitted.size === 0) {
        return allowed.union(permitted);
      }

      const uploaders = assetUploaderResolver ? await assetUploaderResolver([...permitted]) : new Map<string, string>();
      return allowed.union(new Set([...permitted].filter((id) => uploaders.get(id) === auth.user.id)));
    }

    // Admins and editors see media library assets of their areas in the trash (partner sharing hides them).
    case Permission.AssetRead:
    case Permission.AssetView: {
      const missing = ids.difference(allowed);
      if (!userAccess.canEditLibrary || missing.size === 0) {
        return allowed;
      }
      const { permitted } = await checkLibraryAssets(missing, (areaId) => canEditArea(userAccess, areaId));
      return allowed.union(permitted);
    }

    // Usage rights tags of the area accounts are used by the search of users with a level in the area.
    case Permission.TagRead: {
      let result = allowed;
      for (const area of settings.areas) {
        const missing = ids.difference(result);
        if (missing.size > 0 && area.userId && getAreaLevel(userAccess, area.id)) {
          result = result.union(await access.tag.checkOwnerAccess(area.userId, missing));
        }
      }
      return result;
    }

    default: {
      return allowed;
    }
  }
};

/**
Own assets can be deleted permanently by everybody. Media library assets only by admins and by media managers of
their areas.
*/
export const requirePermanentDeleteAccess = async (auth: AuthDto, ids: string[]) => {
  const userAccess = getAccessForAuth(auth);
  if (userAccess.role === 'admin') {
    return;
  }

  const { library, permitted } = await checkLibraryAssets(new Set(ids), (areaId) => canManageArea(userAccess, areaId));
  if (permitted.size < library.size) {
    throw new ForbiddenException('Only media managers can permanently delete assets of their areas');
  }
};

/** Returns the asset ids of an album; registered by the ImagePier gallery service, which can query albums. */
export type AlbumAssetResolver = (albumId: string) => Promise<string[]>;

let albumAssetResolver: AlbumAssetResolver | undefined;

export const setAlbumAssetResolver = (resolver: AlbumAssetResolver | undefined) => {
  albumAssetResolver = resolver;
};

/**
Assets among the given ones that the user may publish with a shared link: own assets, and media library assets of
areas where the user is editor or media manager. Externals do not share media library assets.
*/
const getPermittedToShare = async (auth: AuthDto, ids: string[]) => {
  const userAccess = getAccessForAuth(auth);
  const all = new Set(ids);
  if (userAccess.role === 'admin') {
    return all;
  }

  const { library, permitted } = await checkLibraryAssets(
    all,
    (areaId) => userAccess.role === 'staff' && canEditArea(userAccess, areaId),
  );
  return all.difference(library.difference(permitted));
};

/** Assets among the given ones that the user may publish with a shared link and that are not blocked. */
export const getShareableAssets = async (auth: AuthDto, ids: string[]) => {
  const permitted = await getPermittedToShare(auth, ids);
  return permitted.difference(await getBlockedAssets(permitted));
};

const SHARE_FORBIDDEN = 'Media library assets can only be shared by editors and media managers of their areas';
const SHARE_BLOCKED = 'Blocked assets cannot be shared';

const requirePermittedToShare = async (auth: AuthDto, ids: string[]) => {
  const permitted = await getPermittedToShare(auth, ids);
  if (permitted.size < new Set(ids).size) {
    throw new ForbiddenException(SHARE_FORBIDDEN);
  }
};

/** Shared links with media library assets need the level editor in their areas; blocked assets are refused. */
export const requireShareableAssets = async (auth: AuthDto, ids: string[]) => {
  await requirePermittedToShare(auth, ids);
  if ((await getBlockedAssets(new Set(ids))).size > 0) {
    throw new ForbiddenException(SHARE_BLOCKED);
  }
};

/**
Shared links of albums are checked against the assets the album contains when the link is created.
Blocked assets of the album are not refused here; the shared link does not show them.
*/
export const requireShareableAlbum = async (auth: AuthDto, albumId: string) => {
  if (albumAssetResolver) {
    await requirePermittedToShare(auth, await albumAssetResolver(albumId));
  }
};

/** ImagePier metadata keys that only the server writes. */
export const rejectReservedMetadataKeys = (keys: string[]) => {
  const reserved = keys.filter((key) => RESERVED_METADATA_KEYS.includes(key));
  if (reserved.length > 0) {
    throw new BadRequestException(`Metadata keys reserved for ImagePier: ${reserved.join(', ')}`);
  }
};

type MetadataItem = { key: string; value: Record<string, unknown> };

/**
Applies the ImagePier rules to asset metadata written through Immich's metadata endpoints:
- reserved keys are rejected,
- the release status of media library assets can only be decided by admins and media managers of the area;
  everybody else saves the usage rights as "in review", and blocked assets stay blocked.
Own assets are not restricted.
*/
export const applyMetadataRules = async <T extends MetadataItem>(
  auth: AuthDto,
  items: Array<T & { assetId: string }>,
): Promise<Array<T & { assetId: string }>> => {
  rejectReservedMetadataKeys(items.map((item) => item.key));

  const userAccess = getAccessForAuth(auth);
  const rights = items.filter((item) => item.key === USAGE_RIGHTS_KEY);
  if (userAccess.role === 'admin' || rights.length === 0) {
    return items;
  }

  const { library, permitted } = await checkLibraryAssets(new Set(rights.map((item) => item.assetId)), (areaId) =>
    canManageArea(userAccess, areaId),
  );
  const undecided = library.difference(permitted);
  if (undecided.size === 0) {
    return items;
  }

  const current = releaseStatusResolver ? await releaseStatusResolver([...undecided]) : new Map<string, string>();
  return items.map((item) =>
    rights.includes(item) && undecided.has(item.assetId)
      ? {
          ...item,
          value: { ...item.value, status: current.get(item.assetId) === 'blocked' ? 'blocked' : 'suggested' },
        }
      : item,
  );
};
