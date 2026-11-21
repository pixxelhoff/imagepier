import { getUserAccess, parseAccessSettings } from 'src/imagepier/access-rules.js';

const libraryUserId = 'library-id';

describe('access rules', () => {
  describe('parseAccessSettings', () => {
    it('should drop unknown roles and values', () => {
      expect(
        parseAccessSettings({
          libraryUserId,
          users: { a: { role: 'owner', canUpload: 'yes' }, b: { role: 'manager', canDownload: false } },
        }),
      ).toEqual({
        libraryUserId,
        users: {
          a: { role: undefined, canUpload: undefined, canDownload: undefined },
          b: { role: 'manager', canUpload: undefined, canDownload: false },
        },
      });
    });

    it('should handle empty values', () => {
      expect(parseAccessSettings(null)).toEqual({ libraryUserId: undefined, users: {} });
    });
  });

  describe('getUserAccess', () => {
    it('should keep Immich behaviour without a media library account', () => {
      const access = getUserAccess({ users: { user: { role: 'external' } } }, { id: 'user', isAdmin: false });

      expect(access).toMatchObject({ canUpload: true, canDownload: true, canDeletePermanently: true });
      expect(access.canEditLibrary).toBe(false);
    });

    it('should give admins full access', () => {
      expect(getUserAccess({ libraryUserId, users: {} }, { id: 'admin', isAdmin: true })).toEqual({
        role: 'admin',
        canUpload: true,
        canDownload: true,
        canViewLibrary: true,
        canEditLibrary: true,
        canDeletePermanently: true,
      });
    });

    it('should treat users without settings as staff', () => {
      expect(getUserAccess({ libraryUserId, users: {} }, { id: 'user', isAdmin: false })).toEqual({
        role: 'staff',
        canUpload: false,
        canDownload: true,
        canViewLibrary: true,
        canEditLibrary: false,
        canDeletePermanently: false,
      });
    });

    it('should allow managers to upload and edit the media library', () => {
      const access = getUserAccess(
        { libraryUserId, users: { user: { role: 'manager' } } },
        { id: 'user', isAdmin: false },
      );

      expect(access).toMatchObject({ canUpload: true, canEditLibrary: true, canDeletePermanently: false });
    });

    it('should allow uploads for staff when enabled', () => {
      const access = getUserAccess(
        { libraryUserId, users: { user: { role: 'staff', canUpload: true } } },
        { id: 'user', isAdmin: false },
      );

      expect(access.canUpload).toBe(true);
    });

    it('should hide the media library from externals and block downloads by default', () => {
      const access = getUserAccess(
        { libraryUserId, users: { user: { role: 'external' } } },
        { id: 'user', isAdmin: false },
      );

      expect(access).toMatchObject({ canViewLibrary: false, canDownload: false, canUpload: false });
    });

    it('should allow downloads for externals when enabled', () => {
      const access = getUserAccess(
        { libraryUserId, users: { user: { role: 'external', canDownload: true } } },
        { id: 'user', isAdmin: false },
      );

      expect(access.canDownload).toBe(true);
    });

    it('should allow uploads for the media library account', () => {
      expect(getUserAccess({ libraryUserId, users: {} }, { id: libraryUserId, isAdmin: false }).canUpload).toBe(true);
    });
  });
});
