import { ForbiddenException } from '@nestjs/common';
import { vitest } from 'vitest';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { Permission } from 'src/enum.js';
import {
  applyImagePierAccess,
  requirePermanentDeleteAccess,
  setAssetOwnerResolver,
} from 'src/imagepier/access-hook.js';
import { AccessSettings, SHARED_AREA_ID, setCachedAccessSettings } from 'src/imagepier/access-rules.js';
import type { AccessRepository } from 'src/repositories/access.repository.js';

const libraryUserId = 'library-id';
const areas = [
  { id: SHARED_AREA_ID, name: 'General', userId: libraryUserId },
  { id: 'press', name: 'Press', userId: 'press-account' },
  { id: 'marketing', name: 'Marketing', userId: 'marketing-account' },
];

const authFor = (id: string, isAdmin = false) => ({ user: { id, isAdmin } }) as AuthDto;

const access = {} as AccessRepository;

/** asset-1: press, asset-2: marketing, asset-3: shared area, own: owned by the user */
const owners: Record<string, string> = {
  'asset-1': 'press-account',
  'asset-2': 'marketing-account',
  'asset-3': libraryUserId,
  own: 'user',
};

const resolver = vitest.fn((ids: string[]) =>
  Promise.resolve(new Map(ids.filter((id) => Object.hasOwn(owners, id)).map((id) => [id, owners[id]]))),
);

const useSettings = (users: AccessSettings['users'], withLibrary = true) =>
  setCachedAccessSettings({ libraryUserId: withLibrary ? libraryUserId : undefined, areas, users });

describe('ImagePier access hook', () => {
  beforeEach(() => {
    resolver.mockClear();
    setAssetOwnerResolver(resolver);
  });

  afterEach(() => {
    setCachedAccessSettings({ areas: [], users: {} });
    setAssetOwnerResolver(undefined);
  });

  it('should not change anything without a media library account', async () => {
    useSettings({}, false);
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetUpdate, ids: new Set(['asset-1']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set());
    expect(resolver).not.toHaveBeenCalled();
  });

  it('should allow uploads of own assets for everybody', async () => {
    useSettings({ user: { role: 'external' } });
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetUpload, ids: new Set(['user']) },
      Promise.resolve(new Set(['user'])),
    );

    expect(result).toEqual(new Set(['user']));
  });

  it('should allow downloads of media library assets from areas with the level standard', async () => {
    useSettings({ user: { role: 'external', areas: { press: 'standard', marketing: 'viewer' } } });
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetDownload, ids: new Set(['asset-1', 'asset-2', 'own']) },
      Promise.resolve(new Set(['asset-1', 'asset-2', 'own'])),
    );

    expect(result).toEqual(new Set(['asset-1', 'own']));
  });

  it('should let editors edit media library assets of their areas', async () => {
    useSettings({ user: { role: 'staff', areas: { press: 'editor', marketing: 'standard' } } });
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
    expect(resolver).toHaveBeenCalledWith(['asset-1', 'asset-2', 'asset-3']);
  });

  it('should not let users without editor level edit media library assets', async () => {
    useSettings({ user: { role: 'staff', areas: { press: 'standard' } } });
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetDelete, ids: new Set(['asset-1']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set());
    expect(resolver).not.toHaveBeenCalled();
  });

  describe('requirePermanentDeleteAccess', () => {
    it('should allow everybody to delete own assets', async () => {
      useSettings({});

      await expect(requirePermanentDeleteAccess(authFor('user'), ['own'])).resolves.toBeUndefined();
    });

    it('should allow media managers to delete assets of their areas', async () => {
      useSettings({ user: { role: 'staff', areas: { press: 'manager', marketing: 'editor' } } });

      await expect(requirePermanentDeleteAccess(authFor('user'), ['asset-1'])).resolves.toBeUndefined();
      await expect(requirePermanentDeleteAccess(authFor('user'), ['asset-1', 'asset-2'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admins everything', async () => {
      useSettings({});

      await expect(requirePermanentDeleteAccess(authFor('admin', true), ['asset-1'])).resolves.toBeUndefined();
    });
  });

  it('should let admins view media library assets in the trash', async () => {
    useSettings({});
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('admin', true), permission: Permission.AssetView, ids: new Set(['asset-1', 'asset-9']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set(['asset-1']));
  });

  it('should let users read the tags of the areas they have a level in', async () => {
    useSettings({ user: { role: 'staff', areas: { press: 'viewer' } } });
    const checkOwnerAccess = vitest.fn((_: string, ids: Set<string>) =>
      Promise.resolve(new Set([...ids].filter((id) => id === 'press-tag'))),
    );
    const tagAccess = { tag: { checkOwnerAccess } } as unknown as AccessRepository;
    const result = await applyImagePierAccess(
      tagAccess,
      { auth: authFor('user'), permission: Permission.TagRead, ids: new Set(['press-tag', 'other-tag']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set(['press-tag']));
    expect(checkOwnerAccess).toHaveBeenCalledTimes(1);
    expect(checkOwnerAccess).toHaveBeenCalledWith('press-account', new Set(['press-tag', 'other-tag']));
  });

  it('should not let users without areas read tags of the media library', async () => {
    useSettings({ user: { role: 'external' } });
    const checkOwnerAccess = vitest.fn();
    const tagAccess = { tag: { checkOwnerAccess } } as unknown as AccessRepository;
    const result = await applyImagePierAccess(
      tagAccess,
      { auth: authFor('user'), permission: Permission.TagRead, ids: new Set(['press-tag']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set());
    expect(checkOwnerAccess).not.toHaveBeenCalled();
  });

  it('should not extend viewing for other users', async () => {
    useSettings({});
    const result = await applyImagePierAccess(
      access,
      { auth: authFor('user'), permission: Permission.AssetView, ids: new Set(['asset-1']) },
      Promise.resolve(new Set<string>()),
    );

    expect(result).toEqual(new Set());
    expect(resolver).not.toHaveBeenCalled();
  });
});
