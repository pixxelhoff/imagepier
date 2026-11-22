import {
  getArchiveName,
  isPublishable,
  mergeBranding,
  parseAssetIds,
  parseBranding,
  parseGallerySettings,
} from 'src/imagepier/gallery.js';
import { UsageRights } from 'src/imagepier/usage-rights.js';

const today = new Date('2026-06-01T00:00:00Z');

const rights = (value: Partial<UsageRights>): UsageRights => ({
  version: 1,
  status: 'confirmed',
  permittedUsage: ['web'],
  ...value,
});

describe('ImagePier galleries', () => {
  describe('isPublishable', () => {
    it('should publish confirmed rights for website or press use', () => {
      expect(isPublishable(rights({}), today)).toBe(true);
      expect(isPublishable(rights({ permittedUsage: ['press'] }), today)).toBe(true);
    });

    it('should not publish assets without matching rights', () => {
      expect(isPublishable(undefined, today)).toBe(false);
      expect(isPublishable(rights({ permittedUsage: ['internal', 'print'] }), today)).toBe(false);
      expect(isPublishable(rights({ status: 'suggested' }), today)).toBe(false);
    });

    it('should not publish expired rights', () => {
      expect(isPublishable(rights({ validUntil: '2026-05-31' }), today)).toBe(false);
      expect(isPublishable(rights({ validUntil: '2026-06-01' }), today)).toBe(true);
    });
  });

  describe('parseBranding', () => {
    it('should keep valid values', () => {
      expect(
        parseBranding({
          title: ' Media ',
          color: '#0055A4',
          logo: 'data:image/png;base64,AAAA',
          imprintUrl: 'https://example.com/imprint',
        }),
      ).toEqual({
        title: 'Media',
        color: '#0055A4',
        logo: 'data:image/png;base64,AAAA',
        footer: undefined,
        imprintUrl: 'https://example.com/imprint',
        privacyUrl: undefined,
      });
    });

    it('should drop invalid values', () => {
      expect(
        parseBranding({ color: 'red', logo: 'https://example.com/logo.png', privacyUrl: 'ftp://example.com/privacy' }),
      ).toEqual({
        title: undefined,
        color: undefined,
        logo: undefined,
        footer: undefined,
        imprintUrl: undefined,
        privacyUrl: undefined,
      });
    });
  });

  describe('parseGallerySettings', () => {
    it('should ignore broken entries', () => {
      const gallery = {
        id: 'gallery-1',
        key: 'key-1',
        albumId: 'album-1',
        title: 'Harbour',
        allowDownload: true,
        createdById: 'user-1',
        createdAt: '2026-06-01T00:00:00.000Z',
      };
      expect(parseGallerySettings({ galleries: [gallery, { id: 'broken' }] }).galleries).toEqual([gallery]);
      expect(parseGallerySettings(undefined)).toEqual({ galleries: [], branding: parseBranding(undefined) });
    });

    it('should clean the appearance of a gallery', () => {
      const gallery = { id: 'gallery-1', key: 'key-1', albumId: 'album-1', branding: { color: 'red', title: 'Press' } };
      const [result] = parseGallerySettings({ galleries: [gallery] }).galleries;
      expect(result.branding).toEqual(expect.objectContaining({ title: 'Press', color: undefined }));
    });
  });

  describe('mergeBranding', () => {
    it('should prefer the values of the gallery', () => {
      const defaults = { title: 'Media', color: '#0055a4', imprintUrl: 'https://example.com/imprint' };
      expect(mergeBranding(defaults, { title: 'Press', color: undefined })).toEqual({
        title: 'Press',
        color: '#0055a4',
        imprintUrl: 'https://example.com/imprint',
      });
      expect(mergeBranding(defaults)).toEqual(defaults);
    });
  });

  describe('parseAssetIds', () => {
    it('should keep valid and unique IDs', () => {
      const id = '0f4c2a5e-1b7d-4c55-9a3e-6f1e2d3c4b5a';
      expect(parseAssetIds(` ${id},${id.toUpperCase()},invalid,`)).toEqual([id]);
      expect(parseAssetIds(undefined)).toEqual([]);
    });
  });

  describe('getArchiveName', () => {
    it('should remove characters that are not allowed in file names', () => {
      expect(getArchiveName('Harbour / Sail: 2026?')).toBe('Harbour Sail 2026.zip');
      expect(getArchiveName(' ')).toBe('gallery.zip');
    });
  });
});
