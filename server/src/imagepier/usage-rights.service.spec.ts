import { vitest } from 'vitest';
import { AssetFileType, JobName, SourceType } from 'src/enum.js';
import {
  ASSET_AREA_KEY,
  SHARED_AREA_ID,
  UPLOADED_BY_KEY,
  setCachedAccessSettings,
} from 'src/imagepier/access-rules.js';
import { getTagLabels, getTagPaths } from 'src/imagepier/usage-rights-tags.js';
import { USAGE_RIGHTS_KEY } from 'src/imagepier/usage-rights.js';
import { ImagePierUsageRightsService } from 'src/imagepier/usage-rights.service.js';
import { AssetFactory } from 'test/factories/asset.factory.js';
import { ServiceMocks, newTestService } from 'test/utils.js';

describe(ImagePierUsageRightsService.name, () => {
  let sut: ImagePierUsageRightsService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(ImagePierUsageRightsService));
    mocks.user.getList.mockResolvedValue([]);
    mocks.person.getFaces.mockResolvedValue([]);
  });

  it('should work', () => {
    expect(sut).toBeDefined();
  });

  describe('suggestForAsset', () => {
    it('should not overwrite existing usage rights', async () => {
      mocks.asset.getMetadataByKey.mockResolvedValue({
        key: USAGE_RIGHTS_KEY,
        value: { status: 'confirmed' },
        updatedAt: new Date(),
      });

      await sut.suggestForAsset('asset-id');

      expect(mocks.asset.getById).not.toHaveBeenCalled();
      expect(mocks.asset.upsertMetadata).not.toHaveBeenCalled();
    });

    it('should store a suggestion from metadata and file name', async () => {
      const asset = AssetFactory.create({
        originalPath: '/library/harbour-festival.jpg',
        originalFileName: 'Harbour Festival 2026 (c) ACME, Jane Doe.jpg',
      });
      mocks.asset.getMetadataByKey.mockResolvedValue(undefined);
      mocks.asset.getById.mockResolvedValue(asset as any);
      mocks.metadata.readTags.mockResolvedValue({});

      await sut.suggestForAsset(asset.id);

      expect(mocks.metadata.readTags).toHaveBeenCalledWith('/library/harbour-festival.jpg');
      expect(mocks.asset.upsertMetadata).toHaveBeenCalledWith(asset.id, [
        {
          key: USAGE_RIGHTS_KEY,
          value: expect.objectContaining({
            status: 'suggested',
            suggestedFrom: ['filename'],
            photographer: 'Jane Doe',
            copyrightHolder: 'ACME',
            creditLine: 'Foto: Jane Doe / ACME',
          }),
        },
      ]);
    });

    it('should not store anything when no rights were found', async () => {
      const asset = AssetFactory.create({ originalFileName: 'IMG_0001.jpg' });
      mocks.asset.getMetadataByKey.mockResolvedValue(undefined);
      mocks.asset.getById.mockResolvedValue(asset as any);
      mocks.metadata.readTags.mockResolvedValue({});

      await sut.suggestForAsset(asset.id);

      expect(mocks.asset.upsertMetadata).not.toHaveBeenCalled();
    });
  });

  describe('syncTags', () => {
    it('should add missing and remove outdated usage rights tags', async () => {
      const asset = AssetFactory.create();
      const outdated = { id: 'tag-outdated', value: 'Usage rights/Status/Unreviewed' };
      const unrelated = { id: 'tag-unrelated', value: 'Holidays' };
      mocks.asset.getById.mockResolvedValue({ ...asset, tags: [outdated, unrelated] } as any);
      mocks.asset.getMetadataByKey.mockResolvedValue({
        key: USAGE_RIGHTS_KEY,
        value: { status: 'confirmed', photographer: 'Jane Doe' },
        updatedAt: new Date(),
      });
      mocks.tag.upsertValue.mockImplementation(({ value }) => Promise.resolve({ id: `tag-${value}`, value } as any));

      const result = await sut.syncTags(asset.id, new Date('2026-06-01T12:00:00Z'));

      expect(mocks.tag.removeAssetIds).toHaveBeenCalledTimes(1);
      expect(mocks.tag.removeAssetIds).toHaveBeenCalledWith('tag-outdated', [asset.id]);
      expect(mocks.tag.upsertAssetIds).toHaveBeenCalledWith([
        { assetId: asset.id, tagId: 'tag-Usage rights/Photographer/Jane Doe' },
        { assetId: asset.id, tagId: 'tag-Usage rights/Status/Approved' },
        { assetId: asset.id, tagId: 'tag-Usage rights/Missing/Copyright holder' },
        { assetId: asset.id, tagId: 'tag-Usage rights/Missing/License' },
      ]);
      expect(result).toEqual({ ownerId: asset.ownerId, previous: 'unreviewed', current: 'valid' });
    });

    it('should only keep the missing field tags when no usage rights are stored', async () => {
      const asset = AssetFactory.create();
      mocks.asset.getById.mockResolvedValue({
        ...asset,
        tags: [{ id: 'tag-status', value: 'Usage rights/Status/Valid' }],
      } as any);
      mocks.asset.getMetadataByKey.mockResolvedValue(undefined);
      mocks.tag.upsertValue.mockImplementation(({ value }) => Promise.resolve({ id: `tag-${value}`, value } as any));

      const result = await sut.syncTags(asset.id);

      expect(mocks.tag.removeAssetIds).toHaveBeenCalledWith('tag-status', [asset.id]);
      expect(mocks.tag.upsertAssetIds).toHaveBeenCalledWith([
        { assetId: asset.id, tagId: 'tag-Usage rights/Missing/Copyright holder' },
        { assetId: asset.id, tagId: 'tag-Usage rights/Missing/Photographer' },
        { assetId: asset.id, tagId: 'tag-Usage rights/Missing/License' },
      ]);
      expect(result).toEqual({ ownerId: asset.ownerId, previous: 'valid', current: undefined });
    });
  });

  describe('syncTags with areas', () => {
    it('should read the area from the stored settings outside of the API worker', async () => {
      mocks.systemMetadata.get.mockResolvedValue({
        libraryUserId: 'library-id',
        areas: [{ id: 'press', name: 'Press', userId: 'press-account' }],
        users: {},
      } as any);
      mocks.asset.getById.mockResolvedValue({ id: 'asset-1', ownerId: 'press-account', tags: [] } as any);
      mocks.asset.getMetadataByKey.mockResolvedValue(undefined);
      mocks.tag.upsertValue.mockImplementation(({ value }) => Promise.resolve({ id: `tag-${value}`, value } as any));

      await sut.syncTags('asset-1');

      const areaPath = getTagPaths(getTagLabels()).area;
      expect(mocks.tag.upsertValue).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'press-account', value: `${areaPath}/Press` }),
      );
    });
  });

  describe('migrateAreaAssets', () => {
    it('should move assets of earlier versions to the account of their area', async () => {
      const areaPath = getTagPaths(getTagLabels()).area;
      mocks.systemMetadata.get.mockResolvedValue({
        libraryUserId: 'library-id',
        areas: [{ id: 'press', name: 'Press', userId: 'press-account' }],
        users: {},
      } as any);
      mocks.tag.getAll.mockResolvedValue([
        { id: 'tag-area', value: `${areaPath}/Press` },
        { id: 'tag-other', value: 'Holiday' },
      ] as any);
      mocks.tag.getAssetIdsByTagId.mockResolvedValue(['asset-1', 'asset-2']);
      mocks.asset.getById.mockImplementation(((id: string) =>
        Promise.resolve({ id, ownerId: 'library-id', tags: [] })) as any);
      mocks.asset.getMetadataByKey.mockImplementation(((id: string, key: string) =>
        Promise.resolve(
          key === ASSET_AREA_KEY && id === 'asset-1' ? { key, value: { areaId: 'press' } } : undefined,
        )) as any);
      mocks.tag.upsertValue.mockImplementation(({ value }) => Promise.resolve({ id: `tag-${value}`, value } as any));

      await expect(sut.migrateAreaAssets()).resolves.toBe(1);

      expect(mocks.tag.getAssetIdsByTagId).toHaveBeenCalledTimes(1);
      expect(mocks.asset.updateAll).toHaveBeenCalledTimes(1);
      expect(mocks.asset.updateAll).toHaveBeenCalledWith(['asset-1'], { ownerId: 'press-account' });
    });
  });

  describe('moveToLibrary', () => {
    const libraryUserId = 'library-id';
    const areas = [
      { id: SHARED_AREA_ID, name: 'Shared', userId: libraryUserId },
      { id: 'press', name: 'Press', userId: 'press-account' },
    ];

    afterEach(() => {
      setCachedAccessSettings({ areas: [], users: {} });
    });

    it('should move own assets into the media library', async () => {
      const auth = { user: { id: 'user-id', isAdmin: false } } as any;
      setCachedAccessSettings({
        libraryUserId,
        areas,
        users: { 'user-id': { role: 'staff', areas: { press: 'editor' } } },
      });
      mocks.asset.getByIds.mockResolvedValue([{ id: 'asset-1', ownerId: 'user-id' }] as any);
      mocks.asset.getById.mockResolvedValue(undefined);

      await expect(sut.moveToLibrary(auth, ['asset-1'], 'press')).resolves.toEqual({ count: 1 });

      expect(mocks.asset.updateAll).toHaveBeenCalledWith(['asset-1'], { ownerId: 'press-account' });
      expect(mocks.asset.upsertMetadata).toHaveBeenCalledWith('asset-1', [
        { key: ASSET_AREA_KEY, value: { areaId: 'press' } },
      ]);
      expect(mocks.user.syncUsage).toHaveBeenCalledWith('user-id');
      expect(mocks.user.syncUsage).toHaveBeenCalledWith('press-account');
    });

    it('should recognize faces again for the new owner', async () => {
      const auth = { user: { id: 'user-id', isAdmin: false } } as any;
      setCachedAccessSettings({
        libraryUserId,
        areas,
        users: { 'user-id': { role: 'staff', areas: { press: 'editor' } } },
      });
      mocks.asset.getByIds.mockResolvedValue([{ id: 'asset-1', ownerId: 'user-id' }] as any);
      mocks.asset.getById.mockResolvedValue(undefined);
      mocks.person.getFaces.mockResolvedValue([
        { id: 'face-ml', sourceType: SourceType.MachineLearning, personGroupId: 'old-group' },
        { id: 'face-exif', sourceType: SourceType.Exif, personGroupId: 'old-group' },
        { id: 'face-new', sourceType: SourceType.MachineLearning, personGroupId: null },
      ] as any);

      await sut.moveToLibrary(auth, ['asset-1'], 'press');

      expect(mocks.person.reassignFaces).toHaveBeenCalledWith({ faceIds: ['face-ml'], newPersonGroupId: null });
      expect(mocks.job.queueAll).toHaveBeenCalledWith([
        { name: JobName.FacialRecognition, data: { id: 'face-ml', deferred: false } },
      ]);
    });

    it('should process moved uploads without thumbnails again', async () => {
      const auth = { user: { id: 'user-id', isAdmin: false } } as any;
      setCachedAccessSettings({
        libraryUserId,
        areas,
        users: { 'user-id': { role: 'staff', areas: { press: 'editor' } } },
      });
      mocks.asset.getByIds.mockResolvedValue([
        { id: 'asset-1', ownerId: 'user-id' },
        { id: 'asset-2', ownerId: 'user-id' },
      ] as any);
      mocks.asset.getById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'asset-2'
            ? ({
                id,
                tags: [],
                files: [{ type: AssetFileType.Preview }, { type: AssetFileType.Thumbnail }],
              } as any)
            : ({ id, tags: [], files: [] } as any),
        ),
      );
      vitest.spyOn(sut, 'moveFilesToOwner').mockResolvedValue(true);

      await sut.moveToLibrary(auth, ['asset-1', 'asset-2'], 'press');

      expect(mocks.job.queueAll).toHaveBeenCalledWith([
        { name: JobName.AssetExtractMetadata, data: { id: 'asset-1', source: 'upload' } },
      ]);
    });

    it('should not process assets again when no files were moved', async () => {
      const auth = { user: { id: 'user-id', isAdmin: false } } as any;
      setCachedAccessSettings({
        libraryUserId,
        areas,
        users: { 'user-id': { role: 'staff', areas: { press: 'editor' } } },
      });
      mocks.asset.getByIds.mockResolvedValue([{ id: 'asset-1', ownerId: 'user-id' }] as any);
      mocks.asset.getById.mockResolvedValue({ id: 'asset-1', tags: [], files: [] } as any);
      vitest.spyOn(sut, 'moveFilesToOwner').mockResolvedValue(false);

      await sut.moveToLibrary(auth, ['asset-1'], 'press');

      expect(mocks.job.queueAll).not.toHaveBeenCalled();
    });

    it('should remember who added own assets', async () => {
      const auth = { user: { id: 'user-id', isAdmin: false } } as any;
      setCachedAccessSettings({
        libraryUserId,
        areas,
        users: { 'user-id': { role: 'external', areas: { press: 'editor' } } },
      });
      mocks.asset.getByIds.mockResolvedValue([{ id: 'asset-1', ownerId: 'user-id' }] as any);
      mocks.asset.getById.mockResolvedValue(undefined);

      await sut.moveToLibrary(auth, ['asset-1'], 'press');

      expect(mocks.asset.upsertMetadata).toHaveBeenCalledWith('asset-1', [
        { key: UPLOADED_BY_KEY, value: { userId: 'user-id' } },
      ]);
    });

    it('should not let externals move media library assets', async () => {
      const auth = { user: { id: 'user-id', isAdmin: false } } as any;
      setCachedAccessSettings({
        libraryUserId,
        areas,
        users: { 'user-id': { role: 'external', areas: { press: 'editor', [SHARED_AREA_ID]: 'editor' } } },
      });
      mocks.asset.getByIds.mockResolvedValue([{ id: 'asset-1', ownerId: libraryUserId }] as any);

      await expect(sut.moveToLibrary(auth, ['asset-1'], 'press')).rejects.toThrow('Externals');
      expect(mocks.asset.updateAll).not.toHaveBeenCalled();
    });

    it('should need the level editor in the target area', async () => {
      const auth = { user: { id: 'user-id', isAdmin: false } } as any;
      setCachedAccessSettings({
        libraryUserId,
        areas,
        users: { 'user-id': { role: 'staff', areas: { press: 'standard' } } },
      });

      await expect(sut.moveToLibrary(auth, ['asset-1'], 'press')).rejects.toThrow();
      expect(mocks.asset.updateAll).not.toHaveBeenCalled();
    });

    it('should reject assets of other users', async () => {
      const auth = { user: { id: 'user-id', isAdmin: true } } as any;
      setCachedAccessSettings({ libraryUserId, areas, users: {} });
      mocks.asset.getByIds.mockResolvedValue([{ id: 'asset-1', ownerId: 'someone-else' }] as any);

      await expect(sut.moveToLibrary(auth, ['asset-1'], 'press')).rejects.toThrow();
      expect(mocks.asset.updateAll).not.toHaveBeenCalled();
    });
  });

  describe('getLibraryTags', () => {
    afterEach(() => {
      setCachedAccessSettings({ areas: [], users: {} });
    });

    it('should return the usage rights tags of the media library', async () => {
      const auth = { user: { id: 'user-id', isAdmin: false } } as any;
      const root = getTagLabels().root;
      setCachedAccessSettings({
        libraryUserId: 'library-id',
        areas: [{ id: 'press', name: 'Press', userId: 'press-account' }],
        users: { 'user-id': { role: 'staff', areas: { press: 'viewer' } } },
      });
      mocks.tag.getAll.mockResolvedValue([
        { id: 'tag-1', value: `${root}/Area/Press` },
        { id: 'tag-2', value: 'Holiday' },
      ] as any);

      await expect(sut.getLibraryTags(auth)).resolves.toEqual([
        { id: 'tag-1', value: `${root}/Area/Press`, areaId: 'press' },
      ]);
      expect(mocks.tag.getAll).toHaveBeenCalledWith('press-account');
    });

    it('should return nothing for users without areas', async () => {
      const auth = { user: { id: 'user-id', isAdmin: false } } as any;
      setCachedAccessSettings({ libraryUserId: 'library-id', areas: [], users: { 'user-id': { role: 'external' } } });

      await expect(sut.getLibraryTags(auth)).resolves.toEqual([]);
      expect(mocks.tag.getAll).not.toHaveBeenCalled();
    });
  });

  describe('moveFilesToOwner', () => {
    it('should not move files of assets whose owner is unknown', async () => {
      mocks.asset.getById.mockResolvedValue({ id: 'asset-1', ownerId: 'area', originalPath: '/x', files: [] } as any);

      await expect(sut.moveFilesToOwner('asset-1', [])).resolves.toBe(false);
      expect(mocks.storage.rename).not.toHaveBeenCalled();
    });
  });

  describe('onAssetMetadataExtracted', () => {
    it('should not throw when suggesting fails', async () => {
      mocks.asset.getMetadataByKey.mockRejectedValue(new Error('database unavailable'));

      await expect(sut.onAssetMetadataExtracted({ assetId: 'asset-id', userId: 'user-id' })).resolves.toBeUndefined();
    });
  });

  describe('importUsageRights', () => {
    it('should merge the given fields into existing usage rights', async () => {
      const auth = { user: { id: 'user-id', isAdmin: false } } as any;
      mocks.access.asset.checkOwnerAccess.mockResolvedValue(new Set(['asset-1']));
      mocks.asset.getMetadataByKey.mockResolvedValue({
        key: USAGE_RIGHTS_KEY,
        value: { status: 'suggested', photographer: 'Jane Doe' },
      } as any);
      mocks.asset.getById.mockResolvedValue(undefined);

      await sut.importUsageRights(auth, ['asset-1'], { status: 'confirmed', title: 'Harbour', territory: 'eu' });

      expect(mocks.asset.upsertBulkMetadata).toHaveBeenCalledWith([
        {
          assetId: 'asset-1',
          key: USAGE_RIGHTS_KEY,
          value: expect.objectContaining({
            status: 'confirmed',
            photographer: 'Jane Doe',
            title: 'Harbour',
            territory: 'eu',
          }),
        },
      ]);
    });
  });

  describe('checkImport', () => {
    it('should return files that are already in the own photos', async () => {
      const auth = { user: { id: 'user-id', isAdmin: false } } as any;
      const checksum = 'a'.repeat(40);
      mocks.asset.getByChecksums.mockResolvedValue([
        { id: 'asset-1', checksum: Buffer.from(checksum, 'hex'), deletedAt: null },
      ] as any);

      await expect(sut.checkImport(auth, [checksum, 'b'.repeat(40)])).resolves.toEqual([
        { checksum, areaId: null, assetId: 'asset-1', trashed: false },
      ]);
      expect(mocks.asset.getByChecksums).toHaveBeenCalledWith('user-id', expect.any(Array));
    });
  });
});
