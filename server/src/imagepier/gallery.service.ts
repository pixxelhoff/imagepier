import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { randomBytes, randomUUID } from 'node:crypto';
import sanitize from 'sanitize-filename';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { AssetFileType, AssetType, CacheControl, SystemMetadataKey } from 'src/enum.js';
import { getAccessForAuth, setAlbumAssetResolver } from 'src/imagepier/access-hook.js';
import { canEditArea, getAreaAccounts, getCachedAccessSettings, getUserAccess } from 'src/imagepier/access-rules.js';
import { recordAudit } from 'src/imagepier/audit.js';
import { getChannelLabel } from 'src/imagepier/channels.js';
import { applyUsageRightsCredits } from 'src/imagepier/download-credits.js';
import {
  GALLERY_SETTINGS_KEY,
  Gallery,
  GalleryBranding,
  GallerySettings,
  getArchiveName,
  isPublishable,
  mergeBranding,
  parseBranding,
  parseGallerySettings,
} from 'src/imagepier/gallery.js';
import { getTagLabels } from 'src/imagepier/usage-rights-tags.js';
import { USAGE_RIGHTS_KEY, UsageRights, parseUsageRights } from 'src/imagepier/usage-rights.js';
import { AssetRepository } from 'src/repositories/asset.repository.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';
import { MetadataRepository } from 'src/repositories/metadata.repository.js';
import { ImmichReadStream, StorageRepository } from 'src/repositories/storage.repository.js';
import { SystemMetadataRepository } from 'src/repositories/system-metadata.repository.js';
import type { DB } from 'src/schema/index.js';
import type { SystemMetadata } from 'src/types.js';
import { ImmichFileResponse, getFileNameWithoutExtension, getFilenameExtension } from 'src/utils/file.js';
import { mimeTypes } from 'src/utils/mime-types.js';

const settingsKey = GALLERY_SETTINGS_KEY as SystemMetadataKey;

/** Public gallery content is cached briefly; changes of usage rights appear after this time. */
const CONTENT_TTL_MS = 60_000;

export type GalleryAsset = {
  id: string;
  fileName: string;
  width: number | null;
  height: number | null;
  creditLine: string | null;
  photographer: string | null;
  copyrightHolder: string | null;
  license: string | null;
  licenseSource: string | null;
  usages: string[];
  validUntil: string | null;
  title: string | null;
  altText: string | null;
};

type GalleryContent = { title: string; allowDownload: boolean; assets: GalleryAsset[] };

/**
Public website galleries (see gallery.ts).

Galleries are stored in `system_metadata`; the assets of the album are read with plain SQL,
so the filter by usage rights is applied on the server for every request.
*/
@Injectable()
export class ImagePierGalleryService {
  private content = new Map<string, { value: GalleryContent; loadedAt: number }>();

  constructor(
    @InjectKysely() private db: Kysely<DB>,
    private logger: LoggingRepository,
    private assetRepository: AssetRepository,
    private metadataRepository: MetadataRepository,
    private storageRepository: StorageRepository,
    private systemMetadataRepository: SystemMetadataRepository,
  ) {
    this.logger.setContext(ImagePierGalleryService.name);
    setAlbumAssetResolver((albumId) => this.getAlbumAssetIds(albumId));
  }

  /** Asset ids of an album, used to check shared links of albums. */
  async getAlbumAssetIds(albumId: string) {
    const { rows } = await sql<{ assetId: string }>`
      SELECT aa."assetId" FROM album_asset aa WHERE aa."albumId" = ${albumId}
    `.execute(this.db);
    return rows.map((row) => row.assetId);
  }

  /**
  Whether the creator of a gallery may publish assets of the given owner: own assets, and media library assets of
  areas where the creator is editor or media manager. Administrators publish everything.
  */
  private async getPublishCheck(createdById: string) {
    const { rows } = await sql<{ isAdmin: boolean }>`
      SELECT u."isAdmin" FROM "user" u WHERE u."id" = ${createdById} AND u."deletedAt" IS NULL
    `.execute(this.db);
    const creator = rows[0];
    if (!creator) {
      return () => false;
    }

    const settings = getCachedAccessSettings();
    const access = getUserAccess(settings, { id: createdById, isAdmin: creator.isAdmin });
    const accounts = getAreaAccounts(settings);
    return (ownerId: string) => {
      if (access.role === 'admin' || ownerId === createdById) {
        return true;
      }
      const areaId = accounts.get(ownerId);
      return areaId !== undefined && canEditArea(access, areaId);
    };
  }

  private async load() {
    return parseGallerySettings(await this.systemMetadataRepository.get(settingsKey));
  }

  private async save(settings: GallerySettings) {
    await this.systemMetadataRepository.set(settingsKey, settings as unknown as SystemMetadata[SystemMetadataKey]);
    this.content.clear();
  }

  private requireEditor(auth: AuthDto) {
    const access = getAccessForAuth(auth);
    // Editors and media managers of at least one area; galleries are not available for externals.
    if (access.role !== 'admin' && (access.role === 'external' || !access.canEditLibrary)) {
      throw new ForbiddenException('Only administrators and media managers can manage galleries');
    }
    return access;
  }

  /** Galleries of the user (administrators see all galleries) and the default appearance. */
  async getGalleries(auth: AuthDto) {
    const access = this.requireEditor(auth);
    const { galleries, branding } = await this.load();
    const visible = galleries.filter((gallery) => access.role === 'admin' || gallery.createdById === auth.user.id);
    const albums = await this.getAlbumNames(visible.map((gallery) => gallery.albumId));
    return {
      galleries: visible.map((gallery) => ({ ...gallery, albumName: albums.get(gallery.albumId) ?? null })),
      defaults: branding,
    };
  }

  async createGallery(auth: AuthDto, dto: { albumId: string; title: string; allowDownload: boolean }) {
    const access = this.requireEditor(auth);
    const { rows } = await sql<{ id: string; ownerId: string | null }>`
      SELECT al."id", au."userId" AS "ownerId"
      FROM album al
      LEFT JOIN album_user au ON au."albumId" = al."id" AND au."role" = 'owner'
      WHERE al."id" = ${dto.albumId} AND al."deletedAt" IS NULL
    `.execute(this.db);
    const album = rows[0];
    if (!album) {
      throw new BadRequestException('Album not found');
    }
    if (access.role !== 'admin' && album.ownerId !== auth.user.id) {
      throw new ForbiddenException('Media managers can only publish their own albums');
    }

    const settings = await this.load();
    const gallery: Gallery = {
      id: randomUUID(),
      key: randomBytes(18).toString('base64url'),
      albumId: dto.albumId,
      title: dto.title.trim(),
      allowDownload: dto.allowDownload,
      createdById: auth.user.id,
      createdAt: new Date().toISOString(),
    };
    await this.save({ ...settings, galleries: [...settings.galleries, gallery] });
    return gallery;
  }

  private async requireOwnGallery(auth: AuthDto, id: string) {
    const access = this.requireEditor(auth);
    const settings = await this.load();
    const gallery = settings.galleries.find((item) => item.id === id);
    if (!gallery) {
      throw new BadRequestException('Gallery not found');
    }
    if (access.role !== 'admin' && gallery.createdById !== auth.user.id) {
      throw new ForbiddenException('No access to this gallery');
    }
    return { settings, gallery };
  }

  /** Title, downloads and the own appearance of a gallery. */
  async updateGallery(
    auth: AuthDto,
    id: string,
    dto: { title: string; allowDownload: boolean; branding?: GalleryBranding },
  ) {
    const { settings, gallery } = await this.requireOwnGallery(auth, id);
    const branding = parseBranding(dto.branding);
    const updated: Gallery = {
      ...gallery,
      title: dto.title.trim(),
      allowDownload: dto.allowDownload,
      branding: Object.values(branding).some((value) => value !== undefined) ? branding : undefined,
    };
    await this.save({ ...settings, galleries: settings.galleries.map((item) => (item.id === id ? updated : item)) });
    return updated;
  }

  async deleteGallery(auth: AuthDto, id: string) {
    const { settings, gallery } = await this.requireOwnGallery(auth, id);
    await this.save({ ...settings, galleries: settings.galleries.filter((item) => item.id !== id) });
    return gallery;
  }

  async getBranding() {
    const settings = await this.load();
    return settings.branding;
  }

  async updateBranding(branding: GalleryBranding) {
    const settings = await this.load();
    const value = parseBranding(branding);
    await this.save({ ...settings, branding: value });
    return value;
  }

  private async getAlbumNames(albumIds: string[]) {
    if (albumIds.length === 0) {
      return new Map<string, string>();
    }
    const { rows } = await sql<{ id: string; albumName: string }>`
      SELECT "id", "albumName" FROM album WHERE "id" = ANY (${`{${albumIds.join(',')}}`}::uuid[])
    `.execute(this.db);
    return new Map(rows.map((row) => [row.id, row.albumName]));
  }

  private async getGallery(key: string) {
    const settings = await this.load();
    const gallery = settings.galleries.find((item) => item.key === key);
    if (!gallery) {
      throw new NotFoundException('Gallery not found');
    }
    return { gallery, branding: mergeBranding(settings.branding, gallery.branding) };
  }

  private async getContent(gallery: Gallery): Promise<GalleryContent> {
    const cached = this.content.get(gallery.key);
    if (cached && Date.now() - cached.loadedAt < CONTENT_TTL_MS) {
      return cached.value;
    }

    const { rows } = await sql<{
      id: string;
      ownerId: string;
      originalFileName: string;
      width: number | null;
      height: number | null;
      rights: Record<string, unknown> | null;
    }>`
      SELECT
        a."id",
        a."ownerId",
        a."originalFileName",
        e."exifImageWidth" AS "width",
        e."exifImageHeight" AS "height",
        m."value" AS "rights"
      FROM album_asset aa
      JOIN asset a ON a."id" = aa."assetId"
      LEFT JOIN asset_exif e ON e."assetId" = a."id"
      LEFT JOIN asset_metadata m ON m."assetId" = a."id" AND m."key" = ${USAGE_RIGHTS_KEY}
      WHERE aa."albumId" = ${gallery.albumId}
        AND a."deletedAt" IS NULL
        AND a."type" = ${AssetType.Image}
        AND a."visibility" IN ('timeline', 'archive')
      ORDER BY a."fileCreatedAt" DESC
    `.execute(this.db);

    const labels = getTagLabels();
    const canPublish = await this.getPublishCheck(gallery.createdById);
    const assets: GalleryAsset[] = [];
    for (const row of rows) {
      const rights: UsageRights | undefined = row.rights ? parseUsageRights(row.rights) : undefined;
      if (!rights || !isPublishable(rights) || !canPublish(row.ownerId)) {
        continue;
      }
      assets.push({
        id: row.id,
        fileName: row.originalFileName,
        width: row.width,
        height: row.height,
        creditLine: rights.creditLine ?? null,
        photographer: rights.photographer ?? null,
        copyrightHolder: rights.copyrightHolder ?? null,
        license: rights.licenseType ? labels.licenses[rights.licenseType] : null,
        licenseSource: rights.licenseSource ?? null,
        usages: (rights.permittedUsage ?? []).map((usage) => getChannelLabel(usage)),
        validUntil: rights.validUntil ?? null,
        title: rights.title ?? null,
        altText: rights.altText ?? null,
      });
    }

    const value = { title: gallery.title, allowDownload: gallery.allowDownload, assets };
    this.content.set(gallery.key, { value, loadedAt: Date.now() });
    return value;
  }

  /** Public: title, branding and the published assets of a gallery. */
  async getPublicGallery(key: string) {
    const { gallery, branding } = await this.getGallery(key);
    return { ...(await this.getContent(gallery)), branding };
  }

  private async requirePublishedAsset(key: string, assetId: string) {
    const { gallery } = await this.getGallery(key);
    const content = await this.getContent(gallery);
    if (content.assets.every((asset) => asset.id !== assetId)) {
      throw new NotFoundException('Asset not found');
    }
    return { gallery, content };
  }

  /** Public: thumbnail or preview of a published asset. */
  async viewAsset(key: string, assetId: string, size: 'thumbnail' | 'preview') {
    await this.requirePublishedAsset(key, assetId);
    const type = size === 'preview' ? AssetFileType.Preview : AssetFileType.Thumbnail;
    const { originalFileName, path } = await this.assetRepository.getForThumbnail(assetId, type, true);
    if (!path) {
      throw new NotFoundException('Asset media not found');
    }
    return new ImmichFileResponse({
      path,
      fileName: `${getFileNameWithoutExtension(originalFileName)}_${size}${getFilenameExtension(path)}`,
      contentType: mimeTypes.lookup(path),
      cacheControl: CacheControl.PrivateWithCache,
    });
  }

  /** Public: original of a published asset with usage rights credits; counted in the audit log. */
  async downloadAsset(key: string, assetId: string) {
    const { gallery } = await this.requirePublishedAsset(key, assetId);
    if (!gallery.allowDownload) {
      throw new ForbiddenException('Downloads are disabled for this gallery');
    }

    const { originalPath, originalFileName, editedPath } = await this.assetRepository.getForOriginal(assetId, true);
    const path = editedPath ?? originalPath!;
    const { assetRepository, metadataRepository, storageRepository, logger } = this;
    const repositories = { assetRepository, metadataRepository, storageRepository, logger };

    recordAudit({ action: 'download', assetIds: [assetId], details: { kind: 'gallery', gallery: gallery.title } });

    return new ImmichFileResponse({
      path: await applyUsageRightsCredits(repositories, assetId, path),
      fileName: getFileNameWithoutExtension(originalFileName) + getFilenameExtension(path),
      contentType: mimeTypes.lookup(path),
      cacheControl: CacheControl.PrivateWithoutCache,
    });
  }

  /** Public: ZIP archive of the selected or all published assets, with usage rights credits. */
  async downloadArchive(key: string, assetIds: string[]): Promise<ImmichReadStream> {
    const { gallery } = await this.getGallery(key);
    if (!gallery.allowDownload) {
      throw new ForbiddenException('Downloads are disabled for this gallery');
    }
    const content = await this.getContent(gallery);
    const requested = new Set(assetIds);
    const ids = content.assets
      .filter((asset) => requested.size === 0 || requested.has(asset.id))
      .map((asset) => asset.id);
    if (ids.length === 0) {
      throw new NotFoundException('No assets to download');
    }

    recordAudit({ action: 'download', assetIds: ids, details: { kind: 'gallery', gallery: gallery.title } });

    const zip = this.storageRepository.createZipStream();
    const assets = await this.assetRepository.getForOriginals(ids, true);
    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
    const names: Record<string, number> = {};
    const { assetRepository, metadataRepository, storageRepository, logger } = this;
    const repositories = { assetRepository, metadataRepository, storageRepository, logger };

    for (const id of ids) {
      const asset = assetMap.get(id);
      if (!asset) {
        continue;
      }
      const path = asset.editedPath ?? asset.originalPath;
      const name = getFileNameWithoutExtension(sanitize(asset.originalFileName) || 'image');
      const extension = getFilenameExtension(path);
      const count = names[name + extension] ?? 0;
      names[name + extension] = count + 1;
      const fileName = count === 0 ? name + extension : `${name}+${count}${extension}`;
      zip.addFile(await applyUsageRightsCredits(repositories, id, path), fileName);
    }

    void zip.finalize();

    return {
      stream: zip.stream,
      type: 'application/zip',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(getArchiveName(gallery.title))}`,
    };
  }
}
