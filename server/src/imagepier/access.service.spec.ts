import { vitest } from 'vitest';
import { setCachedAccessSettings } from 'src/imagepier/access-rules.js';
import { ImagePierAccessService, getAreaAccountEmail } from 'src/imagepier/access.service.js';
import { ServiceMocks, newTestService } from 'test/utils.js';

const libraryUserId = 'library-id';

describe(ImagePierAccessService.name, () => {
  let sut: ImagePierAccessService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(ImagePierAccessService));
  });

  afterEach(() => {
    setCachedAccessSettings({ areas: [], users: {} });
  });

  it('should work', () => {
    expect(sut).toBeDefined();
  });

  describe('onUserCreate', () => {
    it('should set up the media library when it does not exist yet', async () => {
      mocks.systemMetadata.get.mockResolvedValue(null);
      await sut.loadSettings();
      const setup = vitest.spyOn(sut, 'setupLibrary').mockResolvedValue();
      const sync = vitest.spyOn(sut, 'syncLibrarySharing').mockResolvedValue();

      await sut.onUserCreate();

      expect(setup).toHaveBeenCalledTimes(1);
      expect(sync).not.toHaveBeenCalled();
    });

    it('should only share the media library when it exists', async () => {
      mocks.systemMetadata.get.mockResolvedValue({ libraryUserId } as any);
      await sut.loadSettings();
      const setup = vitest.spyOn(sut, 'setupLibrary').mockResolvedValue();
      const sync = vitest.spyOn(sut, 'syncLibrarySharing').mockResolvedValue();

      await sut.onUserCreate();

      expect(sync).toHaveBeenCalledTimes(1);
      expect(setup).not.toHaveBeenCalled();
    });

    it('should not wait for a running setup', async () => {
      mocks.systemMetadata.get.mockResolvedValue(null);
      let finish: (() => void) | undefined;
      vitest.spyOn(sut, 'ensureLibraryAccount').mockReturnValue(
        new Promise((resolve) => {
          finish = () => resolve(undefined);
        }),
      );
      const sync = vitest.spyOn(sut, 'syncLibrarySharing').mockResolvedValue();

      const setup = sut.setupLibrary();
      await expect(sut.onUserCreate()).resolves.toBeUndefined();
      finish?.();
      await setup;
      await vitest.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    });
  });

  describe('setupLibrary', () => {
    it('should run only once at a time', async () => {
      mocks.systemMetadata.get.mockResolvedValue(null);
      const ensure = vitest.spyOn(sut, 'ensureLibraryAccount').mockResolvedValue(undefined);

      await Promise.all([sut.setupLibrary(), sut.setupLibrary()]);

      expect(ensure).toHaveBeenCalledTimes(1);
    });
  });

  describe('syncLibrarySharing', () => {
    it('should share the media library with users who have an area', async () => {
      mocks.systemMetadata.get.mockResolvedValue({
        libraryUserId,
        users: {
          external: { role: 'external' },
          shared: { role: 'staff', areas: { shared: 'viewer' } },
          new: { role: 'external', areas: { shared: 'standard' } },
        },
      } as any);
      mocks.partner.getAll.mockResolvedValue([
        { sharedById: libraryUserId, sharedWithId: 'external', inTimeline: true },
        { sharedById: libraryUserId, sharedWithId: 'shared', inTimeline: false },
      ] as any);
      mocks.user.getList.mockResolvedValue([
        { id: libraryUserId, isAdmin: false },
        { id: 'admin', isAdmin: true },
        { id: 'new', isAdmin: false },
        { id: 'external', isAdmin: false },
        { id: 'shared', isAdmin: false },
      ] as any);
      mocks.partner.create.mockResolvedValue({} as any);
      mocks.partner.remove.mockResolvedValue({} as any);
      mocks.partner.update.mockResolvedValue({} as any);

      await sut.loadSettings();
      await sut.syncLibrarySharing();

      expect(mocks.partner.create).toHaveBeenCalledTimes(2);
      expect(mocks.partner.create).toHaveBeenCalledWith({
        sharedById: libraryUserId,
        sharedWithId: 'admin',
        inTimeline: true,
      });
      expect(mocks.partner.create).toHaveBeenCalledWith({
        sharedById: libraryUserId,
        sharedWithId: 'new',
        inTimeline: true,
      });
      expect(mocks.partner.remove).toHaveBeenCalledWith({ sharedById: libraryUserId, sharedWithId: 'external' });
      expect(mocks.partner.update).toHaveBeenCalledWith(
        { sharedById: libraryUserId, sharedWithId: 'shared' },
        { inTimeline: true },
      );
    });

    it('should do nothing without a media library account', async () => {
      mocks.systemMetadata.get.mockResolvedValue(null);

      await sut.loadSettings();
      await sut.syncLibrarySharing();

      expect(mocks.partner.getAll).not.toHaveBeenCalled();
    });
  });

  describe('updateAreas', () => {
    it('should not remove an area that still contains assets', async () => {
      mocks.systemMetadata.get.mockResolvedValue({
        libraryUserId,
        areas: [{ id: 'press', name: 'Press', userId: 'press-account' }],
        users: {},
      } as any);
      mocks.asset.getStatistics.mockResolvedValue({ image: 2, video: 0, audio: 0, other: 0 } as any);

      await expect(sut.updateAreas([{ id: 'shared', name: 'General' }])).rejects.toThrow('still contains assets');
      expect(mocks.systemMetadata.set).not.toHaveBeenCalled();
    });

    it('should remove the account of an empty area', async () => {
      mocks.systemMetadata.get.mockResolvedValue({
        libraryUserId,
        areas: [{ id: 'press', name: 'Press', userId: 'press-account' }],
        users: {},
      } as any);
      mocks.asset.getStatistics.mockResolvedValue({ image: 0, video: 0, audio: 0, other: 0 } as any);
      mocks.partner.getAll.mockResolvedValue([{ sharedById: 'press-account', sharedWithId: 'user' }] as any);
      mocks.user.get.mockResolvedValue({ id: libraryUserId, name: 'Media library: General' } as any);
      mocks.user.getList.mockResolvedValue([]);

      await sut.updateAreas([{ id: 'shared', name: 'General' }]);

      expect(mocks.partner.remove).toHaveBeenCalledWith({ sharedById: 'press-account', sharedWithId: 'user' });
      expect(mocks.user.update).toHaveBeenCalledWith('press-account', expect.objectContaining({ status: 'deleted' }));
    });
  });

  describe('getAreaAccountEmail', () => {
    it('should add the area id to the media library e-mail', () => {
      expect(getAreaAccountEmail('media-library@imagepier.local', 'abc')).toBe('media-library+abc@imagepier.local');
    });
  });

  describe('updateUserAccessAdmin', () => {
    it('should not assign a role to the media library account', async () => {
      mocks.systemMetadata.get.mockResolvedValue({ libraryUserId, users: {} } as any);
      mocks.user.get.mockResolvedValue({ id: libraryUserId, isAdmin: false } as any);

      await sut.loadSettings();

      await expect(sut.updateUserAccessAdmin(libraryUserId, { role: 'staff' })).rejects.toThrow();
    });
  });
});
