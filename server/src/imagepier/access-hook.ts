import { ForbiddenException } from '@nestjs/common';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { Permission } from 'src/enum.js';
import {
  canDownloadArea,
  canEditArea,
  canManageArea,
  getCachedAccessSettings,
  getUserAccess,
} from 'src/imagepier/access-rules.js';
import type { AccessRepository } from 'src/repositories/access.repository.js';

type AccessCheck = { auth: AuthDto; permission: Permission; ids: Set<string> };

/** Returns the area id of each given asset (undefined: no area). */
export type AssetAreaResolver = (assetIds: string[]) => Promise<Map<string, string | undefined>>;

let assetAreaResolver: AssetAreaResolver | undefined;

/** Registered by the ImagePier access service, which can read the asset metadata. */
export const setAssetAreaResolver = (resolver: AssetAreaResolver | undefined) => {
  assetAreaResolver = resolver;
};

/** Access for the current user according to the ImagePier role settings. */
export const getAccessForAuth = (auth: AuthDto) => getUserAccess(getCachedAccessSettings(), auth.user);

/** Media library assets among the given ids, and those of them whose area passes the check. */
const checkLibraryAssets = async (
  access: AccessRepository,
  ids: Set<string>,
  isPermitted: (areaId: string | undefined) => boolean,
) => {
  const { libraryUserId } = getCachedAccessSettings();
  if (!libraryUserId || ids.size === 0) {
    return { library: new Set<string>(), permitted: new Set<string>() };
  }

  const library = await access.asset.checkOwnerAccess(libraryUserId, ids, false);
  if (library.size === 0) {
    return { library, permitted: library };
  }

  const areas = assetAreaResolver ? await assetAreaResolver([...library]) : new Map<string, string | undefined>();
  return { library, permitted: new Set([...library].filter((id) => isPermitted(areas.get(id)))) };
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
  const { libraryUserId } = getCachedAccessSettings();
  if (!libraryUserId) {
    return allowed;
  }

  switch (permission) {
    // Media library assets can be downloaded from areas with the level standard or higher.
    case Permission.AssetDownload: {
      if (userAccess.role === 'admin') {
        return allowed;
      }
      const { library, permitted } = await checkLibraryAssets(access, allowed, (areaId) =>
        canDownloadArea(userAccess, areaId),
      );
      return allowed.difference(library.difference(permitted));
    }

    // Editors and media managers edit and trash media library assets of their areas.
    case Permission.AssetUpdate:
    case Permission.AssetDelete: {
      const missing = ids.difference(allowed);
      if (!userAccess.canEditLibrary || missing.size === 0) {
        return allowed;
      }
      const { permitted } = await checkLibraryAssets(access, missing, (areaId) => canEditArea(userAccess, areaId));
      return allowed.union(permitted);
    }

    // Admins see media library assets in the trash (partner sharing hides trashed assets).
    case Permission.AssetRead:
    case Permission.AssetView: {
      const missing = ids.difference(allowed);
      if (userAccess.role !== 'admin' || missing.size === 0) {
        return allowed;
      }
      return allowed.union(await access.asset.checkOwnerAccess(libraryUserId, missing, false));
    }

    // Area tags of the media library are used for the area views in the sidebar.
    case Permission.TagRead: {
      const missing = ids.difference(allowed);
      if (!userAccess.canViewLibrary || missing.size === 0) {
        return allowed;
      }
      return allowed.union(await access.tag.checkOwnerAccess(libraryUserId, missing));
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
export const requirePermanentDeleteAccess = async (access: AccessRepository, auth: AuthDto, ids: string[]) => {
  const userAccess = getAccessForAuth(auth);
  if (userAccess.role === 'admin') {
    return;
  }

  const { library, permitted } = await checkLibraryAssets(access, new Set(ids), (areaId) =>
    canManageArea(userAccess, areaId),
  );
  if (permitted.size < library.size) {
    throw new ForbiddenException('Only media managers can permanently delete assets of their areas');
  }
};
