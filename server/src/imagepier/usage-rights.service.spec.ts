import { USAGE_RIGHTS_KEY } from 'src/imagepier/usage-rights.js';
import { ImagePierUsageRightsService } from 'src/imagepier/usage-rights.service.js';
import { AssetFactory } from 'test/factories/asset.factory.js';
import { ServiceMocks, newTestService } from 'test/utils.js';

describe(ImagePierUsageRightsService.name, () => {
  let sut: ImagePierUsageRightsService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(ImagePierUsageRightsService));
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
        { assetId: asset.id, tagId: 'tag-Usage rights/Status/Valid' },
      ]);
      expect(result).toEqual({ ownerId: asset.ownerId, previous: 'unreviewed', current: 'valid' });
    });

    it('should remove all usage rights tags when no usage rights are stored', async () => {
      const asset = AssetFactory.create();
      mocks.asset.getById.mockResolvedValue({
        ...asset,
        tags: [{ id: 'tag-status', value: 'Usage rights/Status/Valid' }],
      } as any);
      mocks.asset.getMetadataByKey.mockResolvedValue(undefined);

      await sut.syncTags(asset.id);

      expect(mocks.tag.removeAssetIds).toHaveBeenCalledWith('tag-status', [asset.id]);
      expect(mocks.tag.upsertAssetIds).not.toHaveBeenCalled();
    });
  });

  describe('onAssetMetadataExtracted', () => {
    it('should not throw when suggesting fails', async () => {
      mocks.asset.getMetadataByKey.mockRejectedValue(new Error('database unavailable'));

      await expect(sut.onAssetMetadataExtracted({ assetId: 'asset-id', userId: 'user-id' })).resolves.toBeUndefined();
    });
  });
});
