import { setCachedAccessSettings } from 'src/imagepier/access-rules.js';
import { ImagePierAccessService } from 'src/imagepier/access.service.js';
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

  describe('syncLibrarySharing', () => {
    it('should share the media library with staff and remove it from externals', async () => {
      mocks.systemMetadata.get.mockResolvedValue({
        libraryUserId,
        users: { external: { role: 'external' }, shared: { role: 'staff' } },
      } as any);
      mocks.partner.getAll.mockResolvedValue([
        { sharedById: libraryUserId, sharedWithId: 'external' },
        { sharedById: libraryUserId, sharedWithId: 'shared' },
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
    });

    it('should do nothing without a media library account', async () => {
      mocks.systemMetadata.get.mockResolvedValue(null);

      await sut.loadSettings();
      await sut.syncLibrarySharing();

      expect(mocks.partner.getAll).not.toHaveBeenCalled();
    });
  });

  describe('updateUserAccessAdmin', () => {
    it('should not assign a role to the media library account', async () => {
      mocks.systemMetadata.get.mockResolvedValue({ libraryUserId, users: {} } as any);
      mocks.user.get.mockResolvedValue({ id: libraryUserId, isAdmin: false } as any);

      await sut.loadSettings();

      await expect(sut.updateUserAccessAdmin(libraryUserId, { role: 'manager' })).rejects.toThrow();
    });
  });
});
