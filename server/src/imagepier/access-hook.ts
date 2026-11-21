import { ForbiddenException } from '@nestjs/common';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { Permission } from 'src/enum.js';
import { getCachedAccessSettings, getUserAccess } from 'src/imagepier/access-rules.js';
import type { AccessRepository } from 'src/repositories/access.repository.js';

type AccessCheck = { auth: AuthDto; permission: Permission; ids: Set<string> };

/** Access for the current user according to the ImagePier role settings. */
export const getAccessForAuth = (auth: AuthDto) => getUserAccess(getCachedAccessSettings(), auth.user);

/**
Applies the ImagePier role rules on top of Immich's own access checks.
Called from `checkAccess` in `src/utils/access.ts` for all requests that do not use a shared link.
*/
export const applyImagePierAccess = async (
  access: AccessRepository,
  { auth, permission, ids }: AccessCheck,
  granted: Promise<Set<string>>,
): Promise<Set<string>> => {
  const allowed = await granted;
  const userAccess = getAccessForAuth(auth);

  switch (permission) {
    case Permission.AssetUpload: {
      return userAccess.canUpload ? allowed : new Set();
    }

    case Permission.AssetDownload:
    case Permission.AlbumDownload: {
      return userAccess.canDownload ? allowed : new Set();
    }

    case Permission.AssetUpdate:
    case Permission.AssetDelete: {
      const { libraryUserId } = getCachedAccessSettings();
      const missing = ids.difference(allowed);
      if (!userAccess.canEditLibrary || !libraryUserId || missing.size === 0) {
        return allowed;
      }

      const libraryAssets = await access.asset.checkOwnerAccess(libraryUserId, missing, false);
      return allowed.union(libraryAssets);
    }

    default: {
      return allowed;
    }
  }
};

/** Permanently deleting assets (or emptying the trash) is reserved for admins. */
export const requirePermanentDeleteAccess = (auth: AuthDto) => {
  if (!getAccessForAuth(auth).canDeletePermanently) {
    throw new ForbiddenException('Only administrators can permanently delete assets');
  }
};
