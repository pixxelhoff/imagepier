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

  describe('onAssetMetadataExtracted', () => {
    it('should not throw when suggesting fails', async () => {
      mocks.asset.getMetadataByKey.mockRejectedValue(new Error('database unavailable'));

      await expect(sut.onAssetMetadataExtracted({ assetId: 'asset-id', userId: 'user-id' })).resolves.toBeUndefined();
    });
  });
});
