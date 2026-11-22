import {
  AccessSettings,
  SHARED_AREA_ID,
  canEditArea,
  getUserAccess,
  parseAccessSettings,
  parseAssetArea,
} from 'src/imagepier/access-rules.js';

const libraryUserId = 'library-id';
const areas = [
  { id: SHARED_AREA_ID, name: 'Shared' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'press', name: 'Press' },
];

const settings = (users: AccessSettings['users']): AccessSettings => ({ libraryUserId, areas, users });

describe('access rules', () => {
  describe('parseAccessSettings', () => {
    it('should drop unknown roles and values', () => {
      expect(
        parseAccessSettings({
          libraryUserId,
          users: { a: { role: 'owner', canUpload: 'yes' }, b: { role: 'manager', canDownload: false, areas: ['x'] } },
        }),
      ).toEqual({
        libraryUserId,
        areas: [{ id: SHARED_AREA_ID, name: 'Shared' }],
        users: {
          a: { role: undefined, canUpload: undefined, canDownload: undefined, areas: undefined },
          b: { role: 'manager', canUpload: undefined, canDownload: false, areas: ['x'] },
        },
      });
    });

    it('should always contain the shared area and drop invalid areas', () => {
      expect(
        parseAccessSettings(
          { areas: [{ id: 'press', name: 'Press' }, { id: 'press', name: 'Twice' }, { name: 'x' }] },
          'Übergreifend',
        ).areas,
      ).toEqual([
        { id: SHARED_AREA_ID, name: 'Übergreifend' },
        { id: 'press', name: 'Press' },
      ]);
    });

    it('should handle empty values', () => {
      expect(parseAccessSettings(null)).toEqual({
        libraryUserId: undefined,
        areas: [{ id: SHARED_AREA_ID, name: 'Shared' }],
        users: {},
      });
    });
  });

  describe('parseAssetArea', () => {
    it('should read the area id', () => {
      expect(parseAssetArea({ areaId: 'press' })).toBe('press');
      expect(parseAssetArea(undefined)).toBeUndefined();
      expect(parseAssetArea({ areaId: '' })).toBeUndefined();
    });
  });

  describe('getUserAccess', () => {
    it('should keep Immich behaviour without a media library account', () => {
      const access = getUserAccess({ areas, users: { user: { role: 'external' } } }, { id: 'user', isAdmin: false });

      expect(access).toMatchObject({ canUpload: true, canDownload: true, canDeletePermanently: true });
      expect(access.canEditLibrary).toBe(false);
    });

    it('should give admins full access', () => {
      expect(getUserAccess(settings({}), { id: 'admin', isAdmin: true })).toEqual({
        role: 'admin',
        canUpload: true,
        canDownload: true,
        canViewLibrary: true,
        canEditLibrary: true,
        canDeletePermanently: true,
        areas: [SHARED_AREA_ID, 'marketing', 'press'],
      });
    });

    it('should treat users without settings as staff', () => {
      expect(getUserAccess(settings({}), { id: 'user', isAdmin: false })).toEqual({
        role: 'staff',
        canUpload: false,
        canDownload: true,
        canViewLibrary: true,
        canEditLibrary: false,
        canDeletePermanently: false,
        areas: [],
      });
    });

    it('should allow managers to upload and edit the media library', () => {
      const access = getUserAccess(settings({ user: { role: 'manager', areas: ['press'] } }), {
        id: 'user',
        isAdmin: false,
      });

      expect(access).toMatchObject({ canUpload: true, canEditLibrary: true, canDeletePermanently: false });
      expect(access.areas).toEqual(['press']);
    });

    it('should ignore areas of users that are not media managers', () => {
      const access = getUserAccess(settings({ user: { role: 'staff', areas: ['press'] } }), {
        id: 'user',
        isAdmin: false,
      });

      expect(access.areas).toEqual([]);
    });

    it('should allow uploads for staff when enabled', () => {
      const access = getUserAccess(settings({ user: { role: 'staff', canUpload: true } }), {
        id: 'user',
        isAdmin: false,
      });

      expect(access.canUpload).toBe(true);
    });

    it('should hide the media library from externals and block downloads by default', () => {
      const access = getUserAccess(settings({ user: { role: 'external' } }), { id: 'user', isAdmin: false });

      expect(access).toMatchObject({ canViewLibrary: false, canDownload: false, canUpload: false });
    });

    it('should allow downloads for externals when enabled', () => {
      const access = getUserAccess(settings({ user: { role: 'external', canDownload: true } }), {
        id: 'user',
        isAdmin: false,
      });

      expect(access.canDownload).toBe(true);
    });

    it('should allow uploads for the media library account', () => {
      expect(getUserAccess(settings({}), { id: libraryUserId, isAdmin: false }).canUpload).toBe(true);
    });
  });

  describe('canEditArea', () => {
    it('should limit media managers to their areas and the shared area', () => {
      const access = getUserAccess(settings({ user: { role: 'manager', areas: ['press'] } }), {
        id: 'user',
        isAdmin: false,
      });

      expect(canEditArea(access, 'press')).toBe(true);
      expect(canEditArea(access, SHARED_AREA_ID)).toBe(true);
      expect(canEditArea(access, undefined)).toBe(true);
      expect(canEditArea(access, 'marketing')).toBe(false);
    });

    it('should allow admins everything and staff nothing', () => {
      expect(canEditArea(getUserAccess(settings({}), { id: 'admin', isAdmin: true }), 'marketing')).toBe(true);
      expect(canEditArea(getUserAccess(settings({}), { id: 'user', isAdmin: false }), SHARED_AREA_ID)).toBe(false);
    });
  });
});
