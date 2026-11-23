import { ImagePierKeywordService } from 'src/imagepier/keyword.service.js';
import { KEYWORDS_KEY } from 'src/imagepier/keywords.js';
import { ServiceMocks, newTestService } from 'test/utils.js';

const harbour = { category: 'Place', name: 'Harbour', active: true };
const beach = { category: 'Place', name: 'Beach', active: true };

describe(ImagePierKeywordService.name, () => {
  let sut: ImagePierKeywordService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(ImagePierKeywordService));
    mocks.systemMetadata.get.mockResolvedValue({ keywords: [harbour, beach] });
    mocks.user.getList.mockResolvedValue([{ id: 'user-1' }, { id: 'area-user' }] as any);
    mocks.tag.getByValue.mockResolvedValue(undefined);
    mocks.asset.getForUpdateTags.mockResolvedValue({ tags: [] } as any);
  });

  describe('addKeyword', () => {
    it('should add an active keyword', async () => {
      const keywords = await sut.addKeyword({ category: 'Topic', name: 'Sailing', description: 'Boats' });

      expect(keywords).toEqual([
        harbour,
        beach,
        { category: 'Topic', name: 'Sailing', description: 'Boats', active: true },
      ]);
      expect(mocks.systemMetadata.set).toHaveBeenCalledWith(KEYWORDS_KEY, { keywords });
    });

    it('should reject a keyword that already exists', async () => {
      await expect(sut.addKeyword({ category: 'place', name: 'harbour' })).rejects.toThrow('already exists');
      expect(mocks.systemMetadata.set).not.toHaveBeenCalled();
    });
  });

  describe('editKeyword', () => {
    it('should change the description without touching tags', async () => {
      const keywords = await sut.editKeyword('Place/Harbour', { ...harbour, description: 'Old harbour' });

      expect(keywords[0]).toEqual({ ...harbour, description: 'Old harbour' });
      expect(mocks.tag.getByValue).not.toHaveBeenCalled();
    });

    it('should rename the tags of all accounts', async () => {
      mocks.tag.getByValue.mockImplementation((userId, value) =>
        Promise.resolve(userId === 'area-user' && value === 'Place/Harbour' ? ({ id: 'old-tag' } as any) : undefined),
      );
      mocks.tag.getAssetIdsByTagId.mockResolvedValue(['asset-1', 'asset-2']);
      mocks.tag.upsertValue.mockImplementation(({ value }) => Promise.resolve({ id: `tag-${value}`, value } as any));

      const keywords = await sut.editKeyword('Place/Harbour', { ...harbour, name: 'City Harbour' });

      expect(keywords[0]).toEqual({ ...harbour, name: 'City Harbour' });
      expect(mocks.tag.upsertValue).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'area-user', value: 'Place/City Harbour' }),
      );
      expect(mocks.tag.upsertAssetIds).toHaveBeenCalledWith([
        { assetId: 'asset-1', tagId: 'tag-Place/City Harbour' },
        { assetId: 'asset-2', tagId: 'tag-Place/City Harbour' },
      ]);
      expect(mocks.tag.delete).toHaveBeenCalledWith('old-tag');
      expect(mocks.job.queueAll).toHaveBeenCalledTimes(1);
    });

    it('should reject a new name that already exists', async () => {
      await expect(sut.editKeyword('Place/Harbour', { ...harbour, name: 'Beach' })).rejects.toThrow('already exists');
      expect(mocks.tag.delete).not.toHaveBeenCalled();
    });
  });

  describe('deleteKeyword', () => {
    it('should refuse to delete a keyword that is still assigned', async () => {
      mocks.tag.getByValue.mockResolvedValue({ id: 'tag-1' } as any);
      mocks.tag.getAssetIdsByTagId.mockResolvedValue(['asset-1']);

      await expect(sut.deleteKeyword('Place/Harbour')).rejects.toThrow('still assigned');
      expect(mocks.tag.delete).not.toHaveBeenCalled();
    });

    it('should delete an unused keyword and its empty tags', async () => {
      mocks.tag.getByValue.mockResolvedValue({ id: 'tag-1' } as any);
      mocks.tag.getAssetIdsByTagId.mockResolvedValue([]);

      const keywords = await sut.deleteKeyword('Place/Harbour');

      expect(keywords).toEqual([beach]);
      expect(mocks.tag.delete).toHaveBeenCalledWith('tag-1');
    });
  });
});
