import type { Tags } from 'exiftool-vendored';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { getChannelLabel } from 'src/imagepier/channels.js';
import { formatMessage, getTagLabels, type TagLabels } from 'src/imagepier/usage-rights-tags.js';
import { USAGE_RIGHTS_KEY, parseUsageRights, type UsageRights } from 'src/imagepier/usage-rights.js';
import type { AssetRepository } from 'src/repositories/asset.repository.js';
import type { LoggingRepository } from 'src/repositories/logging.repository.js';
import type { MetadataRepository } from 'src/repositories/metadata.repository.js';
import type { StorageRepository } from 'src/repositories/storage.repository.js';

/*
Usage rights in downloaded files.

When an asset with usage rights is downloaded, ImagePier writes photographer, copyright, credit line and usage
terms into a temporary copy of the file (IPTC/XMP/EXIF via exiftool) and sends that copy instead of the original.
Originals in the library are never modified. Temporary copies are removed after one hour.
*/

/** File types exiftool can safely write to. Other files are downloaded unchanged. */
export const CREDIT_FILE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.heic', '.heif']);

export const DOWNLOAD_TEMP_FOLDER = join(tmpdir(), 'imagepier-downloads');

const TEMP_MAX_AGE_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = 0;

export type DownloadCreditRepositories = {
  assetRepository: Pick<AssetRepository, 'getMetadataByKey'>;
  metadataRepository: Pick<MetadataRepository, 'writeTags'>;
  storageRepository: Pick<StorageRepository, 'copyFile' | 'mkdirSync' | 'readdir' | 'stat' | 'unlinkDir'>;
  logger: Pick<LoggingRepository, 'warn'>;
};

const formatDate = (value: string, locale: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

export const buildUsageTerms = (
  rights: UsageRights,
  labels: TagLabels = getTagLabels(),
  channelLabel: (id: string) => string = (id) => labels.usages[id] ?? id,
) => {
  const parts: string[] = [];
  if (rights.licenseType) {
    parts.push(formatMessage(labels.usageTerms.license, { value: labels.licenses[rights.licenseType] }));
  }

  if (rights.permittedUsage && rights.permittedUsage.length > 0) {
    const usages = rights.permittedUsage.map((usage) => channelLabel(usage)).join(', ');
    parts.push(formatMessage(labels.usageTerms.usage, { value: usages }));
  }

  if (rights.conditionalUsage && rights.conditionalUsage.length > 0) {
    const usages = rights.conditionalUsage.map((usage) => channelLabel(usage)).join(', ');
    const note = rights.usageNote ? ` (${rights.usageNote})` : '';
    parts.push(formatMessage(labels.usageTerms.conditionalUsage, { value: `${usages}${note}` }));
  }

  if (rights.validUntil) {
    parts.push(formatMessage(labels.usageTerms.validUntil, { value: formatDate(rights.validUntil, labels.locale) }));
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
};

/** Metadata tags written into downloaded files. Only filled-in values are included. */
export const buildCreditTags = (rights: UsageRights, labels: TagLabels = getTagLabels()) => {
  const tags: Record<string, string> = {};
  if (rights.photographer) {
    tags.Creator = rights.photographer;
  }

  if (rights.copyrightHolder) {
    tags.Copyright = rights.copyrightHolder.startsWith('©') ? rights.copyrightHolder : `© ${rights.copyrightHolder}`;
  }

  if (rights.creditLine) {
    tags['IPTC:Credit'] = rights.creditLine;
    tags['XMP-photoshop:Credit'] = rights.creditLine;
  }

  const usageTerms = buildUsageTerms(rights, labels, (id) => getChannelLabel(id));
  if (usageTerms) {
    tags['XMP-xmpRights:UsageTerms'] = usageTerms;
  }

  if (rights.licenseSource && /^https?:\/\//i.test(rights.licenseSource)) {
    tags['XMP-xmpRights:WebStatement'] = rights.licenseSource;
  }

  return tags;
};

const cleanupTempFolder = async ({ storageRepository }: DownloadCreditRepositories, now: number) => {
  let entries: string[];
  try {
    entries = await storageRepository.readdir(DOWNLOAD_TEMP_FOLDER);
  } catch {
    return;
  }

  for (const entry of entries) {
    const folder = join(DOWNLOAD_TEMP_FOLDER, entry);
    try {
      const { mtimeMs } = await storageRepository.stat(folder);
      if (now - mtimeMs > TEMP_MAX_AGE_MS) {
        await storageRepository.unlinkDir(folder, { recursive: true, force: true });
      }
    } catch {
      // already removed by a parallel cleanup
    }
  }
};

/**
Returns the path of the file to send for a download: a temporary copy with usage rights credits, or the original
path when the asset has no usage rights, the file type is not supported or writing fails.
*/
export const applyUsageRightsCredits = async (
  repositories: DownloadCreditRepositories,
  assetId: string,
  path: string,
  now = Date.now(),
): Promise<string> => {
  if (!CREDIT_FILE_EXTENSIONS.has(extname(path).toLowerCase())) {
    return path;
  }

  try {
    const item = await repositories.assetRepository.getMetadataByKey(assetId, USAGE_RIGHTS_KEY);
    if (!item) {
      return path;
    }

    const tags = buildCreditTags(parseUsageRights(item.value));
    if (Object.keys(tags).length === 0) {
      return path;
    }

    if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
      lastCleanup = now;
      void cleanupTempFolder(repositories, now);
    }

    const folder = join(DOWNLOAD_TEMP_FOLDER, randomUUID());
    repositories.storageRepository.mkdirSync(folder);
    const target = join(folder, basename(path));
    await repositories.storageRepository.copyFile(path, target);
    await repositories.metadataRepository.writeTags(target, tags as Partial<Tags>);
    return target;
  } catch (error) {
    repositories.logger.warn(`Unable to add usage rights to download of asset ${assetId}: ${error}`);
    return path;
  }
};
