import { ForbiddenException } from '@nestjs/common';
import { vitest } from 'vitest';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { Permission } from 'src/enum.js';
import { applyImagePierAccess, requirePermanentDeleteAccess, setAssetAreaResolver } from 'src/imagepier/access-hook.js';
import { AccessSettings, setCachedAccessSettings } from 'src/imagepier/access-rules.js';
import type { AccessRepository } from 'src/repositories/access.repository.js';

const libraryUserId = 'library-id';

const authFor = (id: string, isAdmin = false) => ({ user: { id, isAdmin } }) as AuthDto;

const createAccess = (libraryAssets: string[] = []) => {
  const checkOwnerAccess = vitest.fn((_: string, ids: Set<string>) =>
    Promise.resolve(new Set([...ids].filter((id) => libraryAssets.includes(id)))),
  );
  return { access: { asset: { checkOwnerAccess } } as unknown as AccessRepository, checkOwnerAccess };
};

const useSettings = (settings: AccessSettings) => setCachedAccessSettings(settings);

describe('ImagePier access hook', () => {
  afterEach(() => {
    setCachedAccessSettings({ areas: [], users: {} });
    setAssetAreaResolver(undefined);
  });

  it('should not change anything without a media library account', async () => {
    const { access, checkOwnerAccess } = createAccess(['asset-1']);
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetUpdate, ids: new Set(['asset-1']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set());
    expect(checkOwnerAccess).not.toHaveBeenCalled();
  });

  it('should block uploads for staff without upload permission', async () => {
    useSettings({ libraryUserId, areas: [], users: {} });
    const { access } = createAccess();
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetUpload, ids: new Set(['user']) },
      Promise.resolve(new Set(['user'])),
    );

    expect(result).toEqual(new Set());
  });

  it('should block downloads for externals', async () => {
    useSettings({ libraryUserId, areas: [], users: { user: { role: 'external' } } });
    const { access } = createAccess();
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetDownload, ids: new Set(['asset-1']) },
      Promise.resolve(new Set(['asset-1'])),
    );

    expect(result).toEqual(new Set());
  });

  it('should let managers edit media library assets', async () => {
    useSettings({ libraryUserId, areas: [], users: { user: { role: 'manager' } } });
    const { access, checkOwnerAccess } = createAccess(['asset-2']);
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetUpdate, ids: new Set(['asset-1', 'asset-2', 'asset-3']) },
      Promise.resolve(new Set(['asset-1'])),
    );

    expect(result).toEqual(new Set(['asset-1', 'asset-2']));
    expect(checkOwnerAccess).toHaveBeenCalledWith(libraryUserId, new Set(['asset-2', 'asset-3']), false);
  });

  it('should limit media managers to assets of their areas', async () => {
    useSettings({ libraryUserId, areas: [], users: { user: { role: 'manager', areas: ['press'] } } });
    const areasById: Record<string, string> = { 'asset-1': 'press', 'asset-2': 'marketing' };
    setAssetAreaResolver((ids) =>
      Promise.resolve(new Map<string, string | undefined>(ids.map((id) => [id, areasById[id]]))),
    );
    const { access } = createAccess(['asset-1', 'asset-2', 'asset-3']);
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetUpdate, ids: new Set(['asset-1', 'asset-2', 'asset-3']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set(['asset-1', 'asset-3']));
  });

  it('should not let staff edit media library assets', async () => {
    useSettings({ libraryUserId, areas: [], users: {} });
    const { access, checkOwnerAccess } = createAccess(['asset-1']);
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetDelete, ids: new Set(['asset-1']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set());
    expect(checkOwnerAccess).not.toHaveBeenCalled();
  });

  it('should only allow admins to delete permanently', () => {
    useSettings({ libraryUserId, areas: [], users: { user: { role: 'manager' } } });

    expect(() => requirePermanentDeleteAccess(authFor('user'))).toThrow(ForbiddenException);
    expect(() => requirePermanentDeleteAccess(authFor('admin', true))).not.toThrow();
  });

  it('should let admins view media library assets in the trash', async () => {
    useSettings({ libraryUserId, areas: [], users: {} });
    const { access } = createAccess(['asset-1']);
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('admin', true), permission: Permission.AssetView, ids: new Set(['asset-1', 'asset-2']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set(['asset-1']));
  });

  it('should not extend viewing for other users', async () => {
    useSettings({ libraryUserId, areas: [], users: {} });
    const { access, checkOwnerAccess } = createAccess(['asset-1']);
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetView, ids: new Set(['asset-1']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set());
    expect(checkOwnerAccess).not.toHaveBeenCalled();
  });
});
