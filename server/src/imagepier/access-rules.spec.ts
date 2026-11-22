import {
  AccessSettings,
  SHARED_AREA_ID,
  canDownloadArea,
  canEditArea,
  canManageArea,
  getAreaAccounts,
  getAreaOfOwner,
  getUserAccess,
  isAtLeast,
  parseAccessSettings,
  parseAssetArea,
  parseStoredUserAccess,
} from 'src/imagepier/access-rules.js';

const libraryUserId = 'library-id';
const areas = [
  { id: SHARED_AREA_ID, name: 'General' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'press', name: 'Press' },
];

const settings = (users: AccessSettings['users']): AccessSettings => ({ libraryUserId, areas, users });
const user = { id: 'user', isAdmin: false };

describe('access rules', () => {
  describe('parseAccessSettings', () => {
    it('should drop unknown roles, levels and areas', () => {
      expect(
        parseAccessSettings({
          libraryUserId,
          users: { a: { role: 'owner' }, b: { role: 'staff', areas: { press: 'editor', marketing: 'boss' } } },
        }),
      ).toEqual({
        libraryUserId,
        areaAssetsMigrated: false,
        areas: [{ id: SHARED_AREA_ID, name: 'Shared', userId: libraryUserId }],
        users: {
          a: { role: undefined, areas: undefined },
          b: { role: 'staff', areas: { press: 'editor' } },
        },
      });
    });

    it('should always contain the shared area and drop invalid areas', () => {
      expect(
        parseAccessSettings(
          { areas: [{ id: 'press', name: 'Press' }, { id: 'press', name: 'Twice' }, { name: 'x' }] },
          'General',
        ).areas,
      ).toEqual([
        { id: SHARED_AREA_ID, name: 'General' },
        { id: 'press', name: 'Press' },
      ]);
    });

    it('should keep the area accounts and use the media library account for the shared area', () => {
      const result = parseAccessSettings({
        libraryUserId,
        areaAssetsMigrated: true,
        areas: [
          { id: SHARED_AREA_ID, name: 'General', userId: 'other' },
          { id: 'press', name: 'Press', userId: 'press-account' },
        ],
      });

      expect(result.areaAssetsMigrated).toBe(true);
      expect(result.areas).toEqual([
        { id: SHARED_AREA_ID, name: 'General', userId: libraryUserId },
        { id: 'press', name: 'Press', userId: 'press-account' },
      ]);
    });

    it('should handle empty values', () => {
      expect(parseAccessSettings(null)).toEqual({
        libraryUserId: undefined,
        areaAssetsMigrated: false,
        areas: [{ id: SHARED_AREA_ID, name: 'Shared' }],
        users: {},
      });
    });
  });

  describe('parseStoredUserAccess', () => {
    it('should convert former media managers', () => {
      expect(parseStoredUserAccess({ role: 'manager', canUpload: true, areas: ['press', 'marketing'] })).toEqual({
        role: 'staff',
        areas: { press: 'manager', marketing: 'manager' },
      });
    });

    it('should drop former area lists of other roles', () => {
      expect(parseStoredUserAccess({ role: 'staff', areas: ['press'] })).toEqual({ role: 'staff', areas: undefined });
    });

    it('should not make externals media managers', () => {
      expect(parseStoredUserAccess({ role: 'external', areas: { press: 'manager' } })).toEqual({
        role: 'external',
        areas: { press: 'editor' },
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

  describe('area accounts', () => {
    const withAccounts: AccessSettings = {
      libraryUserId,
      areas: [
        { id: SHARED_AREA_ID, name: 'General', userId: libraryUserId },
        { id: 'press', name: 'Press', userId: 'press-account' },
        { id: 'marketing', name: 'Marketing' },
      ],
      users: {},
    };

    it('should map accounts to their areas', () => {
      expect(getAreaAccounts(withAccounts)).toEqual(
        new Map([
          [libraryUserId, SHARED_AREA_ID],
          ['press-account', 'press'],
        ]),
      );
    });

    it('should find the area of an owner', () => {
      expect(getAreaOfOwner(withAccounts, 'press-account')?.id).toBe('press');
      expect(getAreaOfOwner(withAccounts, 'user')).toBeUndefined();
    });
  });

  describe('isAtLeast', () => {
    it('should compare levels', () => {
      expect(isAtLeast('manager', 'editor')).toBe(true);
      expect(isAtLeast('standard', 'editor')).toBe(false);
      expect(isAtLeast(undefined, 'viewer')).toBe(false);
    });
  });

  describe('getUserAccess', () => {
    it('should keep Immich behaviour without a media library account', () => {
      const access = getUserAccess({ areas, users: { user: { role: 'external' } } }, user);

      expect(access.canViewLibrary).toBe(true);
      expect(access.canEditLibrary).toBe(false);
    });

    it('should give admins every area', () => {
      expect(getUserAccess(settings({}), { id: 'admin', isAdmin: true })).toEqual({
        role: 'admin',
        areas: { [SHARED_AREA_ID]: 'manager', marketing: 'manager', press: 'manager' },
        canViewLibrary: true,
        canEditLibrary: true,
      });
    });

    it('should give users without settings no area', () => {
      expect(getUserAccess(settings({}), user)).toEqual({
        role: 'staff',
        areas: {},
        canViewLibrary: false,
        canEditLibrary: false,
      });
    });

    it('should use the levels of existing areas only', () => {
      const access = getUserAccess(
        settings({ user: { role: 'staff', areas: { press: 'editor', gone: 'manager' } } }),
        user,
      );

      expect(access).toEqual({ role: 'staff', areas: { press: 'editor' }, canViewLibrary: true, canEditLibrary: true });
    });

    it('should not let viewers edit', () => {
      const access = getUserAccess(settings({ user: { role: 'external', areas: { press: 'standard' } } }), user);

      expect(access).toMatchObject({ role: 'external', canViewLibrary: true, canEditLibrary: false });
    });
  });

  describe('area checks', () => {
    const access = getUserAccess(
      settings({
        user: { role: 'staff', areas: { press: 'manager', marketing: 'editor', [SHARED_AREA_ID]: 'viewer' } },
      }),
      user,
    );

    it('should check downloads', () => {
      expect(canDownloadArea(access, 'marketing')).toBe(true);
      expect(canDownloadArea(access, SHARED_AREA_ID)).toBe(false);
      expect(canDownloadArea(access, undefined)).toBe(false);
    });

    it('should check editing', () => {
      expect(canEditArea(access, 'press')).toBe(true);
      expect(canEditArea(access, 'marketing')).toBe(true);
      expect(canEditArea(access, SHARED_AREA_ID)).toBe(false);
    });

    it('should check managing', () => {
      expect(canManageArea(access, 'press')).toBe(true);
      expect(canManageArea(access, 'marketing')).toBe(false);
    });
  });
});
