import { vitest } from 'vitest';
import {
  CREDIT_FILE_EXTENSIONS,
  DOWNLOAD_TEMP_FOLDER,
  applyUsageRightsCredits,
  buildCreditTags,
  buildUsageTerms,
} from 'src/imagepier/download-credits.js';
import { getTagLabels } from 'src/imagepier/usage-rights-tags.js';
import { USAGE_RIGHTS_KEY, UsageRights } from 'src/imagepier/usage-rights.js';

const rights: UsageRights = {
  version: 1,
  status: 'confirmed',
  photographer: 'Jane Doe',
  copyrightHolder: 'ACME',
  licenseType: 'time-limited',
  licenseSource: 'https://example.com/license',
  permittedUsage: ['web', 'print'],
  validUntil: '2027-12-31',
  creditLine: 'Foto: ACME / Jane Doe',
  notes: 'internal note',
};

const newRepositories = (value?: Record<string, unknown>) => ({
  assetRepository: {
    getMetadataByKey: vitest.fn().mockResolvedValue(value ? { key: USAGE_RIGHTS_KEY, value } : undefined),
  },
  metadataRepository: { writeTags: vitest.fn() },
  storageRepository: {
    copyFile: vitest.fn(),
    mkdirSync: vitest.fn(),
    readdir: vitest.fn().mockResolvedValue([]),
    stat: vitest.fn(),
    unlinkDir: vitest.fn(),
  },
  logger: { warn: vitest.fn() },
});

describe('download credits', () => {
  describe('buildUsageTerms', () => {
    it('should describe license, usage and expiry', () => {
      expect(buildUsageTerms(rights, getTagLabels('en'))).toBe(
        'License: Time-limited. Permitted use: Website, Print. Valid until 2027-12-31.',
      );
    });

    it('should use the configured language', () => {
      expect(buildUsageTerms(rights, getTagLabels('de'))).toBe(
        'Lizenz: Zeitlich begrenzt. Erlaubte Nutzung: Website, Print. Gültig bis 31.12.2027.',
      );
    });

    it('should return nothing without license information', () => {
      expect(buildUsageTerms({ version: 1, status: 'suggested', photographer: 'Jane Doe' })).toBeUndefined();
    });
  });

  describe('buildCreditTags', () => {
    it('should map usage rights to metadata tags', () => {
      expect(buildCreditTags(rights, getTagLabels('en'))).toEqual({
        Creator: 'Jane Doe',
        Copyright: '© ACME',
        'IPTC:Credit': 'Foto: ACME / Jane Doe',
        'XMP-photoshop:Credit': 'Foto: ACME / Jane Doe',
        'XMP-xmpRights:UsageTerms': 'License: Time-limited. Permitted use: Website, Print. Valid until 2027-12-31.',
        'XMP-xmpRights:WebStatement': 'https://example.com/license',
      });
    });

    it('should not duplicate the copyright sign', () => {
      expect(buildCreditTags({ version: 1, status: 'confirmed', copyrightHolder: '© ACME' })).toEqual({
        Copyright: '© ACME',
      });
    });

    it('should write title and alternative text', () => {
      expect(
        buildCreditTags({ version: 1, status: 'confirmed', title: 'Harbour at night', altText: 'Boats in a harbour' }),
      ).toEqual({
        'XMP-dc:Title': 'Harbour at night',
        'IPTC:ObjectName': 'Harbour at night',
        'XMP-iptcCore:AltTextAccessibility': 'Boats in a harbour',
      });
    });

    it('should never include internal notes', () => {
      expect(Object.values(buildCreditTags(rights))).not.toContain('internal note');
    });
  });

  describe('applyUsageRightsCredits', () => {
    it('should support common image formats only', () => {
      expect(CREDIT_FILE_EXTENSIONS.has('.jpg')).toBe(true);
      expect(CREDIT_FILE_EXTENSIONS.has('.mp4')).toBe(false);
    });

    it('should keep the original for unsupported file types', async () => {
      const repositories = newRepositories({ ...rights });

      await expect(applyUsageRightsCredits(repositories, 'asset-1', '/data/video.mp4')).resolves.toBe(
        '/data/video.mp4',
      );
      expect(repositories.assetRepository.getMetadataByKey).not.toHaveBeenCalled();
    });

    it('should keep the original without usage rights', async () => {
      const repositories = newRepositories();

      await expect(applyUsageRightsCredits(repositories, 'asset-1', '/data/photo.jpg')).resolves.toBe(
        '/data/photo.jpg',
      );
      expect(repositories.storageRepository.copyFile).not.toHaveBeenCalled();
    });

    it('should write the credits into a temporary copy', async () => {
      const repositories = newRepositories({ ...rights });

      const path = await applyUsageRightsCredits(repositories, 'asset-1', '/data/photo.jpg');

      expect(path.startsWith(DOWNLOAD_TEMP_FOLDER)).toBe(true);
      expect(path.endsWith('/photo.jpg')).toBe(true);
      expect(repositories.assetRepository.getMetadataByKey).toHaveBeenCalledWith('asset-1', USAGE_RIGHTS_KEY);
      expect(repositories.storageRepository.copyFile).toHaveBeenCalledWith('/data/photo.jpg', path);
      expect(repositories.metadataRepository.writeTags).toHaveBeenCalledWith(
        path,
        expect.objectContaining({ Creator: 'Jane Doe', Copyright: '© ACME' }),
      );
    });

    it('should fall back to the original when copying fails', async () => {
      const repositories = newRepositories({ ...rights });
      repositories.storageRepository.copyFile.mockRejectedValue(new Error('disk full'));

      await expect(applyUsageRightsCredits(repositories, 'asset-1', '/data/photo.jpg')).resolves.toBe(
        '/data/photo.jpg',
      );
      expect(repositories.logger.warn).toHaveBeenCalled();
    });
  });
});
