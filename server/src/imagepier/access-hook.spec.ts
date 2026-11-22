import { ForbiddenException } from '@nestjs/common';
import { vitest } from 'vitest';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { Permission } from 'src/enum.js';
import { applyImagePierAccess, requirePermanentDeleteAccess, setAssetAreaResolver } from 'src/imagepier/access-hook.js';
import { AccessSettings, SHARED_AREA_ID, setCachedAccessSettings } from 'src/imagepier/access-rules.js';
import type { AccessRepository } from 'src/repositories/access.repository.js';

const libraryUserId = 'library-id';
const areas = [
  { id: SHARED_AREA_ID, name: 'General' },
  { id: 'press', name: 'Press' },
  { id: 'marketing', name: 'Marketing' },
];

const authFor = (id: string, isAdmin = false) => ({ user: { id, isAdmin } }) as AuthDto;

const createAccess = (libraryAssets: string[] = []) => {
  const checkOwnerAccess = vitest.fn((_: string, ids: Set<string>) =>
    Promise.resolve(new Set([...ids].filter((id) => libraryAssets.includes(id)))),
  );
  return { access: { asset: { checkOwnerAccess } } as unknown as AccessRepository, checkOwnerAccess };
};

/** asset-1: press, asset-2: marketing, asset-3: no area (shared) */
const useAreas = () => {
  const areasById: Record<string, string> = { 'asset-1': 'press', 'asset-2': 'marketing' };
  setAssetAreaResolver((ids) =>
    Promise.resolve(new Map<string, string | undefined>(ids.map((id) => [id, areasById[id]]))),
  );
};

const useSettings = (users: AccessSettings['users'], withLibrary = true) =>
  setCachedAccessSettings({ libraryUserId: withLibrary ? libraryUserId : undefined, areas, users });

describe('ImagePier access hook', () => {
  afterEach(() => {
    setCachedAccessSettings({ areas: [], users: {} });
    setAssetAreaResolver(undefined);
  });

  it('should not change anything without a media library account', async () => {
    useSettings({}, false);
    const { access, checkOwnerAccess } = createAccess(['asset-1']);
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetUpdate, ids: new Set(['asset-1']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set());
    expect(checkOwnerAccess).not.toHaveBeenCalled();
  });

  it('should allow uploads of own assets for everybody', async () => {
    useSettings({ user: { role: 'external' } });
    const { access } = createAccess();
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetUpload, ids: new Set(['user']) },
      Promise.resolve(new Set(['user'])),
    );

    expect(result).toEqual(new Set(['user']));
  });

  it('should allow downloads of media library assets from areas with the level standard', async () => {
    useSettings({ user: { role: 'external', areas: { press: 'standard', marketing: 'viewer' } } });
    useAreas();
    const { access } = createAccess(['asset-1', 'asset-2', 'asset-3']);
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetDownload, ids: new Set(['asset-1', 'asset-2', 'own']) },
      Promise.resolve(new Set(['asset-1', 'asset-2', 'own'])),
    );

    expect(result).toEqual(new Set(['asset-1', 'own']));
  });

  it('should let editors edit media library assets of their areas', async () => {
    useSettings({ user: { role: 'staff', areas: { press: 'editor', marketing: 'standard' } } });
    useAreas();
    const { access, checkOwnerAccess } = createAccess(['asset-1', 'asset-2', 'asset-3']);
    const result = await applyImagePierAccess(
      access,
      {
        auth: authFor('user'),
        permission: Permission.AssetUpdate,
        ids: new Set(['own', 'asset-1', 'asset-2', 'asset-3']),
      },
      Promise.resolve(new Set(['own'])),
    );

    expect(result).toEqual(new Set(['own', 'asset-1']));
    expect(checkOwnerAccess).toHaveBeenCalledWith(libraryUserId, new Set(['asset-1', 'asset-2', 'asset-3']), false);
  });

  it('should not let users without editor level edit media library assets', async () => {
    useSettings({ user: { role: 'staff', areas: { press: 'standard' } } });
    const { access, checkOwnerAccess } = createAccess(['asset-1']);
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetDelete, ids: new Set(['asset-1']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set());
    expect(checkOwnerAccess).not.toHaveBeenCalled();
  });

  describe('requirePermanentDeleteAccess', () => {
    it('should allow everybody to delete own assets', async () => {
      useSettings({});
      const { access } = createAccess(['asset-1']);

      await expect(requirePermanentDeleteAccess(access, authFor('user'), ['own'])).resolves.toBeUndefined();
    });

    it('should allow media managers to delete assets of their areas', async () => {
      useSettings({ user: { role: 'staff', areas: { press: 'manager', marketing: 'editor' } } });
      useAreas();
      const { access } = createAccess(['asset-1', 'asset-2']);

      await expect(requirePermanentDeleteAccess(access, authFor('user'), ['asset-1'])).resolves.toBeUndefined();
      await expect(requirePermanentDeleteAccess(access, authFor('user'), ['asset-1', 'asset-2'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admins everything', async () => {
      useSettings({});
      const { access } = createAccess(['asset-1']);

      await expect(requirePermanentDeleteAccess(access, authFor('admin', true), ['asset-1'])).resolves.toBeUndefined();
    });
  });

  it('should let admins view media library assets in the trash', async () => {
    useSettings({});
    const { access } = createAccess(['asset-1']);
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('admin', true), permission: Permission.AssetView, ids: new Set(['asset-1', 'asset-2']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set(['asset-1']));
  });

  it('should let users with an area read the tags of the media library', async () => {
    useSettings({ user: { role: 'staff', areas: { press: 'viewer' } } });
    const checkOwnerAccess = vitest.fn((_: string, ids: Set<string>) =>
      Promise.resolve(new Set([...ids].filter((id) => id === 'area-tag'))),
    );
    const access = { tag: { checkOwnerAccess } } as unknown as AccessRepository;
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.TagRead, ids: new Set(['area-tag', 'other-tag']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set(['area-tag']));
    expect(checkOwnerAccess).toHaveBeenCalledWith(libraryUserId, new Set(['area-tag', 'other-tag']));
  });

  it('should not let users without areas read tags of the media library', async () => {
    useSettings({ user: { role: 'external' } });
    const checkOwnerAccess = vitest.fn();
    const access = { tag: { checkOwnerAccess } } as unknown as AccessRepository;
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.TagRead, ids: new Set(['area-tag']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set());
    expect(checkOwnerAccess).not.toHaveBeenCalled();
  });

  it('should not extend viewing for other users', async () => {
    useSettings({});
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
