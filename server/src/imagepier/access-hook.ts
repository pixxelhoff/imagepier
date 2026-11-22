import { ForbiddenException } from '@nestjs/common';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { Permission } from 'src/enum.js';
import {
  canDownloadArea,
  canEditArea,
  canManageArea,
  getAreaAccounts,
  getAreaLevel,
  getCachedAccessSettings,
  getUserAccess,
} from 'src/imagepier/access-rules.js';
import type { AccessRepository } from 'src/repositories/access.repository.js';

type AccessCheck = { auth: AuthDto; permission: Permission; ids: Set<string> };

/** Returns the owner id of each given asset; unknown assets are missing. */
export type AssetOwnerResolver = (assetIds: string[]) => Promise<Map<string, string>>;

let assetOwnerResolver: AssetOwnerResolver | undefined;

/** Registered by the ImagePier access service, which can read the assets. */
export const setAssetOwnerResolver = (resolver: AssetOwnerResolver | undefined) => {
  assetOwnerResolver = resolver;
};

/** Access for the current user according to the ImagePier role settings. */
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
    case Permission.AssetDownload: {
      if (userAccess.role === 'admin') {
        return allowed;
      }
      const { library, permitted } = await checkLibraryAssets(allowed, (areaId) => canDownloadArea(userAccess, areaId));
      return allowed.difference(library.difference(permitted));
    }

    // Editors and media managers edit and trash media library assets of their areas.
    case Permission.AssetUpdate:
    case Permission.AssetDelete: {
      const missing = ids.difference(allowed);
      if (!userAccess.canEditLibrary || missing.size === 0) {
        return allowed;
      }
      const { permitted } = await checkLibraryAssets(missing, (areaId) => canEditArea(userAccess, areaId));
      return allowed.union(permitted);
    }

    // Admins see media library assets in the trash (partner sharing hides trashed assets).
    case Permission.AssetRead:
    case Permission.AssetView: {
      const missing = ids.difference(allowed);
      if (userAccess.role !== 'admin' || missing.size === 0) {
        return allowed;
      }
      const { library } = await checkLibraryAssets(missing, () => true);
      return allowed.union(library);
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
