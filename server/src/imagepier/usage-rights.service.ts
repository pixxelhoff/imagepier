import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { OnEvent } from 'src/decorators.js';
import { AuthDto } from 'src/dtos/auth.dto.js';
import { mapNotification } from 'src/dtos/notification.dto.js';
import {
  AssetPathType,
  ImmichWorker,
  JobName,
  NotificationLevel,
  NotificationType,
  Permission,
  SourceType,
  SystemMetadataKey,
} from 'src/enum.js';
import { getAccessForAuth, setReleaseStatusResolver } from 'src/imagepier/access-hook.js';
import {
  ACCESS_SETTINGS_KEY,
  ASSET_AREA_KEY,
  UPLOADED_BY_KEY,
  canEditArea,
  getAreaAccounts,
  getAreaLevel,
  getAreaOfOwner,
  getCachedAccessSettings,
  getSharedAreaName,
  parseAccessSettings,
  parseAssetArea,
} from 'src/imagepier/access-rules.js';
import { setAreaMigrations } from 'src/imagepier/access.service.js';
import { FolderOwner, getRelocatedPath } from 'src/imagepier/asset-files.js';
import {
  CHANNELS_KEY,
  Channel,
  getChannelLabel,
  normalizeChannels,
  parseChannelSettings,
  setCachedChannels,
} from 'src/imagepier/channels.js';
import {
  EXPIRING_SOON_DAYS,
  MISSING_FIELDS,
  USAGE_RIGHTS_STATUSES,
  UsageRightsStatus,
  formatMessage,
  getStatusFromTagValues,
  getTagLabels,
  getTagPaths,
  getUsageRightsStatus,
  getUsageRightsTagValues,
} from 'src/imagepier/usage-rights-tags.js';
import {
  UsageRightsStatus as ReleaseStatus,
  USAGE_RIGHTS_KEY,
  UsageRights,
  parseUsageRights,
  suggestUsageRights,
} from 'src/imagepier/usage-rights.js';
import type { ArgOf } from 'src/repositories/event.repository.js';
import { BaseService } from 'src/services/base.service.js';
import type { SystemMetadata } from 'src/types.js';
import { handlePromiseError } from 'src/utils/misc.js';
import { upsertTags } from 'src/utils/tag.js';

/** Daily at 03:17 (server time) */
const REFRESH_CRON_NAME = 'ImagePierUsageRightsRefresh';
const REFRESH_CRON_EXPRESSION = '17 3 * * *';

export type UsageRightsSyncResult = {
  ownerId: string;
  previous?: UsageRightsStatus;
  current?: UsageRightsStatus;
};

/**
Usage rights service.

- Pre-fills usage rights (photographer, copyright holder, credit line) for new assets after
  Immich extracted their metadata. Existing usage rights are never overwritten.
- Mirrors usage rights into Immich tags, so they can be used in search and filters.
- Refreshes the expiry status daily and notifies owners about expiring and expired licenses.
*/
@Injectable()
export class ImagePierUsageRightsService extends BaseService {
  @OnEvent({ name: 'AssetMetadataExtracted' })
  async onAssetMetadataExtracted({ assetId }: ArgOf<'AssetMetadataExtracted'>) {
    try {
      await this.suggestForAsset(assetId);
      await this.syncTags(assetId);
    } catch (error) {
      this.logger.warn(`Unable to process usage rights for asset ${assetId}: ${error}`);
    }
  }

  @OnEvent({ name: 'ConfigInit', workers: [ImmichWorker.Api] })
  onConfigInit() {
    setAreaMigrations({ moveAssets: () => this.migrateAreaAssets(), moveFiles: () => this.moveAreaAssetFiles() });
    setReleaseStatusResolver((assetIds) => this.getReleaseStatuses(assetIds));
    // Status tags of earlier versions are renamed once after an update.
    handlePromiseError(this.refreshStatuses(), this.logger);
    this.cronRepository.create({
      name: REFRESH_CRON_NAME,
      expression: REFRESH_CRON_EXPRESSION,
      start: true,
      onTick: () => handlePromiseError(this.refreshStatuses(), this.logger),
    });
  }

  async suggestForAsset(assetId: string) {
    const existing = await this.assetRepository.getMetadataByKey(assetId, USAGE_RIGHTS_KEY);
    if (existing) {
      return;
    }

    const asset = await this.assetRepository.getById(assetId);
    if (!asset) {
      return;
    }

    const tags = await this.metadataRepository.readTags(asset.originalPath);
    const suggestion = suggestUsageRights(tags as unknown as Record<string, unknown>, asset.originalFileName);
    if (!suggestion) {
      return;
    }

    await this.assetRepository.upsertMetadata(assetId, [
      { key: USAGE_RIGHTS_KEY, value: suggestion as unknown as Record<string, unknown> },
    ]);
    this.logger.debug(`Suggested usage rights for asset ${assetId}`);
  }

  /** Loads the channel list in every worker, so downloads and galleries show the configured names. */
  @OnEvent({ name: 'ConfigInit' })
  async onConfigInitChannels() {
    try {
      await this.getChannels();
    } catch (error) {
      this.logger.warn(`Unable to load the channels: ${error}`);
    }
  }

  async getChannels(): Promise<Channel[]> {
    const channels = parseChannelSettings(await this.systemMetadataRepository.get(CHANNELS_KEY as SystemMetadataKey));
    setCachedChannels(channels);
    return channels;
  }

  /**
  Saves the channel list. Channels keep their ids, so usage rights stay assigned; the tags of renamed channels are
  updated in the background.
  */
  async updateChannels(items: unknown[]): Promise<Channel[]> {
    const previous = await this.getChannels();
    const channels = normalizeChannels(items);
    for (const channel of previous) {
      if (!channels.some((item) => item.id === channel.id)) {
        channels.push({ ...channel, active: false });
      }
    }
    await this.systemMetadataRepository.set(
      CHANNELS_KEY as SystemMetadataKey,
      { channels } as unknown as SystemMetadata[SystemMetadataKey],
    );
    setCachedChannels(channels);

    const renamed = previous
      .filter((channel) => channels.some((item) => item.id === channel.id && item.label !== channel.label))
      .map((channel) => channel.label);
    if (renamed.length > 0) {
      handlePromiseError(this.renameChannelTags(renamed), this.logger);
    }
    return channels;
  }

  /** Gives assets with tags of renamed channels the current tags and removes the old tags. */
  private async renameChannelTags(oldLabels: string[]) {
    const tagLabels = getTagLabels();
    const paths = getTagPaths(tagLabels);
    const values = oldLabels.flatMap((label) => [
      `${paths.usage}/${label}`,
      `${paths.root}/${tagLabels.conditionalUsage}/${label}`,
    ]);
    for (const user of await this.userRepository.getList()) {
      for (const value of values) {
        const tag = await this.tagRepository.getByValue(user.id, value);
        if (!tag) {
          continue;
        }
        for (const assetId of await this.tagRepository.getAssetIdsByTagId(tag.id)) {
          await this.syncTags(assetId);
        }
        await this.tagRepository.delete(tag.id);
      }
    }
  }

  async getUsageRights(assetId: string): Promise<UsageRights | undefined> {
    const item = await this.assetRepository.getMetadataByKey(assetId, USAGE_RIGHTS_KEY);
    return item ? parseUsageRights(item.value) : undefined;
  }

  /** Release status of each given asset that has usage rights. */
  async getReleaseStatuses(assetIds: string[]) {
    const statuses = new Map<string, ReleaseStatus>();
    for (const assetId of assetIds) {
      const rights = await this.getUsageRights(assetId);
      if (rights) {
        statuses.set(assetId, rights.status);
      }
    }
    return statuses;
  }

  /** Brings the usage rights tags of an asset in line with its stored usage rights. */
  async syncTags(assetId: string, today = new Date()): Promise<UsageRightsSyncResult | undefined> {
    const asset = await this.assetRepository.getById(assetId, { tags: true });
    if (!asset) {
      return;
    }

    const rights = await this.getUsageRights(assetId);
    const areaName = await this.getAreaName(asset.ownerId);
    const tagLabels = getTagLabels();
    const rootPrefix = `${getTagPaths(tagLabels).root}/`;
    const currentTags = (asset.tags ?? []).filter((tag) => tag.value.startsWith(rootPrefix));
    const channels = await this.getChannels();
    const desiredValues = getUsageRightsTagValues(rights, today, tagLabels, areaName, (id) =>
      getChannelLabel(id, channels),
    );
    const desiredTags = await upsertTags(this.tagRepository, { userId: asset.ownerId, tags: desiredValues });

    const desiredIds = new Set(desiredTags.map((tag) => tag.id));
    const currentIds = new Set(currentTags.map((tag) => tag.id));

    for (const tag of currentTags) {
      if (!desiredIds.has(tag.id)) {
        await this.tagRepository.removeAssetIds(tag.id, [assetId]);
      }
    }

    const missing = desiredTags.filter((tag) => !currentIds.has(tag.id));
    if (missing.length > 0) {
      await this.tagRepository.upsertAssetIds(missing.map((tag) => ({ assetId, tagId: tag.id })));
    }

    return {
      ownerId: asset.ownerId,
      previous: getStatusFromTagValues(
        currentTags.map((tag) => tag.value),
        tagLabels,
      ),
      current: rights ? getUsageRightsStatus(rights, today) : undefined,
    };
  }

  /**
  Access settings read from the database. The in-memory cache exists only in the API worker, but tags are also
  synchronized by the microservices worker after the metadata extraction.
  */
  private async loadAccessSettings() {
    const value = await this.systemMetadataRepository.get(ACCESS_SETTINGS_KEY as SystemMetadataKey);
    return parseAccessSettings(value, getSharedAreaName());
  }

  /** Name of the area of a media library asset (the area of its owner). */
  private async getAreaName(ownerId: string) {
    return getAreaOfOwner(await this.loadAccessSettings(), ownerId)?.name;
  }

  /** Usage rights tags of the areas the user has a level in; tags belong to the account of each area. */
  async getLibraryTags(auth: AuthDto) {
    const { libraryUserId, areas } = getCachedAccessSettings();
    const access = getAccessForAuth(auth);
    if (!libraryUserId) {
      return [];
    }

    const prefix = `${getTagPaths(getTagLabels()).root}/`;
    const result: Array<{ id: string; value: string; areaId: string }> = [];
    for (const area of areas) {
      if (!area.userId || !getAreaLevel(access, area.id)) {
        continue;
      }
      for (const tag of await this.tagRepository.getAll(area.userId)) {
        if (tag.value.startsWith(prefix)) {
          result.push({ id: tag.id, value: tag.value, areaId: area.id });
        }
      }
    }
    return result;
  }

  /**
  Moves own assets and media library assets into an area: they become assets of the area account.
  Needs the level editor in the target area; media library assets also need it in their current area.
  */
  async moveToLibrary(auth: AuthDto, assetIds: string[], areaId: string) {
    const settings = getCachedAccessSettings();
    const target = settings.areas.find((area) => area.id === areaId);
    if (!settings.libraryUserId) {
      throw new BadRequestException('The media library is not set up');
    }

    if (!target) {
      throw new BadRequestException('Unknown area');
    }

    if (!target.userId) {
      throw new BadRequestException('The area is not set up yet');
    }

    const access = getAccessForAuth(auth);
    if (!canEditArea(access, areaId)) {
      throw new ForbiddenException('No access to this area');
    }

    const accounts = getAreaAccounts(settings);
    const assets = await this.assetRepository.getByIds(assetIds);
    const ownIds = assets.filter((asset) => asset.ownerId === auth.user.id).map((asset) => asset.id);
    const libraryIds = assets
      .filter((asset) => accounts.has(asset.ownerId) && asset.ownerId !== auth.user.id)
      .map((asset) => asset.id);
    if (ownIds.length + libraryIds.length !== new Set(assetIds).size) {
      throw new BadRequestException('Not found or no access');
    }

    if (libraryIds.length > 0) {
      // Externals add own assets to areas, but do not move media library assets between areas.
      if (access.role === 'external') {
        throw new ForbiddenException('Externals cannot move media library assets');
      }
      await this.requireAccess({ auth, permission: Permission.AssetUpdate, ids: libraryIds });
    }

    // All assets are own or media library assets (checked above).
    const moved = assets.filter((asset) => asset.ownerId !== target.userId);
    const moveIds = moved.map((asset) => asset.id);
    if (moveIds.length > 0) {
      await this.assetRepository.updateAll(moveIds, { ownerId: target.userId });
      const users = await this.getFolderOwners();
      for (const assetId of moveIds) {
        await this.tryMoveFilesToOwner(assetId, users);
        await this.moveTagsToOwner(assetId, target.userId);
      }

      // The storage usage moves with the assets.
      for (const ownerId of new Set([...moved.map((asset) => asset.ownerId), target.userId])) {
        await this.userRepository.syncUsage(ownerId);
      }
      await this.recognizeFacesForNewOwner(moveIds, target.userId);
    }

    for (const assetId of [...ownIds, ...libraryIds]) {
      await this.assetRepository.upsertMetadata(assetId, [{ key: ASSET_AREA_KEY, value: { areaId } }]);
      await this.syncTags(assetId);
    }

    // Remembers who added own assets, so externals can maintain the assets they delivered.
    for (const assetId of ownIds) {
      await this.assetRepository.upsertMetadata(assetId, [{ key: UPLOADED_BY_KEY, value: { userId: auth.user.id } }]);
    }

    return { count: ownIds.length + libraryIds.length };
  }

  /**
  People belong to an account: faces keep the person of the previous owner. Faces found by machine learning are
  unassigned and recognized again, so the people appear in the new owner's account (and in the area).
  */
  private async recognizeFacesForNewOwner(assetIds: string[], ownerId: string) {
    const faceIds: string[] = [];
    for (const assetId of assetIds) {
      const faces = await this.personRepository.getFaces(assetId, { viewingUserId: ownerId });
      for (const face of faces) {
        if (face.sourceType === SourceType.MachineLearning && face.personGroupId) {
          faceIds.push(face.id);
        }
      }
    }
    if (faceIds.length === 0) {
      return;
    }

    await this.personRepository.reassignFaces({ faceIds, newPersonGroupId: null });
    await this.jobRepository.queueAll(
      faceIds.map((id) => ({ name: JobName.FacialRecognition, data: { id, deferred: false } })),
    );
  }

  /** Tags belong to an account: after an owner change the asset gets the tags of the same name of its new owner. */
  private async moveTagsToOwner(assetId: string, ownerId: string) {
    const asset = await this.assetRepository.getById(assetId, { tags: true });
    const tags = asset?.tags ?? [];
    if (tags.length === 0) {
      return;
    }

    const owned = await upsertTags(this.tagRepository, { userId: ownerId, tags: tags.map((tag) => tag.value) });
    const ownedIds = new Set(owned.map((tag) => tag.id));
    for (const tag of tags) {
      if (!ownedIds.has(tag.id)) {
        await this.tagRepository.removeAssetIds(tag.id, [assetId]);
      }
    }
    await this.tagRepository.upsertAssetIds(owned.map((tag) => ({ assetId, tagId: tag.id })));
  }

  /**
  Earlier versions kept all media library assets in one account and stored the area in the asset metadata.
  Moves those assets to the account of their area; called once by the access service after the area accounts exist.
  */
  async migrateAreaAssets() {
    const settings = await this.loadAccessSettings();
    const { libraryUserId } = settings;
    if (!libraryUserId) {
      return 0;
    }

    // Every media library asset carries an area tag of its owner ("Usage rights/Area/…").
    const areaPrefix = `${getTagPaths(getTagLabels()).area}/`;
    const assetIds = new Set<string>();
    for (const tag of await this.tagRepository.getAll(libraryUserId)) {
      if (tag.value.startsWith(areaPrefix)) {
        for (const assetId of await this.tagRepository.getAssetIdsByTagId(tag.id)) {
          assetIds.add(assetId);
        }
      }
    }

    let count = 0;
    const users = await this.getFolderOwners();
    for (const assetId of assetIds) {
      const asset = await this.assetRepository.getById(assetId);
      const item = await this.assetRepository.getMetadataByKey(assetId, ASSET_AREA_KEY);
      const area = settings.areas.find(({ id }) => id === parseAssetArea(item?.value));
      if (!asset || asset.ownerId !== libraryUserId || !area?.userId || area.userId === libraryUserId) {
        continue;
      }

      await this.assetRepository.updateAll([assetId], { ownerId: area.userId });
      await this.syncTags(assetId);
      await this.tryMoveFilesToOwner(assetId, users);
      count++;
    }
    return count;
  }

  /**
  Earlier versions changed only the owner of assets assigned to areas, so their files stayed in the folders of the
  previous owner, which Immich removes when that user is deleted. Moves these files into the folders of the area
  accounts; called once by the access service.
  */
  async moveAreaAssetFiles() {
    const accounts = getAreaAccounts(await this.loadAccessSettings());
    const users = await this.getFolderOwners();
    const areaPrefix = `${getTagPaths(getTagLabels()).area}/`;
    let count = 0;
    for (const accountId of accounts.keys()) {
      for (const tag of await this.tagRepository.getAll(accountId)) {
        if (!tag.value.startsWith(areaPrefix)) {
          continue;
        }
        for (const assetId of await this.tagRepository.getAssetIdsByTagId(tag.id)) {
          if (await this.tryMoveFilesToOwner(assetId, users)) {
            count++;
          }
        }
      }
    }
    return count;
  }

  /** All users with their storage labels, to find the folders of previous owners. */
  private async getFolderOwners(): Promise<FolderOwner[]> {
    const users = await this.userRepository.getList({ withDeleted: true });
    return users.map((user) => ({ id: user.id, storageLabel: user.storageLabel }));
  }

  private async tryMoveFilesToOwner(assetId: string, users: FolderOwner[]) {
    try {
      return await this.moveFilesToOwner(assetId, users);
    } catch (error) {
      this.logger.warn(`Unable to move the files of asset ${assetId} to the folders of its owner: ${error}`);
      return false;
    }
  }

  /**
  Moves the original, thumbnails and encoded videos of an asset into the folders of its owner, and the video part
  of a live photo along with it. Returns whether files were moved.
  */
  async moveFilesToOwner(assetId: string, users: FolderOwner[]): Promise<boolean> {
    const asset = await this.assetRepository.getById(assetId, { files: true });
    const owner = users.find((user) => user.id === asset?.ownerId);
    if (!asset || !owner) {
      return false;
    }

    let moved = false;
    const originalPath = getRelocatedPath(asset.originalPath, owner, users);
    if (originalPath && (await this.isFreePath(originalPath))) {
      const stats = await this.storageRepository.stat(asset.originalPath);
      await this.storageCore.moveFile({
        entityId: asset.id,
        pathType: AssetPathType.Original,
        oldPath: asset.originalPath,
        newPath: originalPath,
        assetInfo: { sizeInBytes: stats.size, checksum: asset.checksum },
      });
      moved = true;
    }

    for (const file of asset.files ?? []) {
      const path = getRelocatedPath(file.path, owner, users);
      if (!path || !(await this.isFreePath(path))) {
        continue;
      }

      if (file.isEdited) {
        // Immich's move only tracks unedited files.
        this.storageCore.ensureFolders(path);
        await this.storageRepository.rename(file.path, path);
        await this.assetRepository.upsertFile({ assetId: asset.id, type: file.type, path, isEdited: true });
      } else {
        await this.storageCore.moveFile({ entityId: asset.id, pathType: file.type, oldPath: file.path, newPath: path });
      }
      moved = true;
    }

    // The video part of a live photo is a hidden asset of its own and belongs to the same owner.
    if (asset.livePhotoVideoId) {
      const [video] = await this.assetRepository.getByIds([asset.livePhotoVideoId]);
      if (video && video.ownerId !== asset.ownerId) {
        await this.assetRepository.updateAll([video.id], { ownerId: asset.ownerId });
      }
      if (video && (await this.moveFilesToOwner(video.id, users))) {
        moved = true;
      }
    }

    return moved;
  }

  private async isFreePath(path: string) {
    if (await this.storageRepository.checkFileExists(path)) {
      this.logger.warn(`Not moving a file to ${path}: the file already exists`);
      return false;
    }
    return true;
  }

  /** Called by the web app after usage rights were saved. */
  async syncTagsForAssets(auth: AuthDto, assetIds: string[]) {
    await this.requireAccess({ auth, permission: Permission.AssetUpdate, ids: assetIds });
    for (const assetId of assetIds) {
      await this.syncTags(assetId);
    }
  }

  /** Tag names used for usage rights, so the web app can build its search filters. */
  getUsageRightsConfig() {
    const tagLabels = getTagLabels();
    const paths = getTagPaths(tagLabels);
    return {
      tags: paths,
      statuses: Object.fromEntries(
        USAGE_RIGHTS_STATUSES.map((status) => [status, `${paths.status}/${tagLabels.statuses[status]}`]),
      ),
      missing: Object.fromEntries(
        MISSING_FIELDS.map((field) => [field, `${paths.missing}/${tagLabels.missingFields[field]}`]),
      ),
      expiringSoonDays: EXPIRING_SOON_DAYS,
    };
  }

  /**
  Re-evaluates the status of all assets that are not expired or blocked and notifies their owners.
  Assets with status tags of earlier versions get the current tags; the old tags are removed.
  */
  async refreshStatuses(today = new Date()) {
    const tagLabels = getTagLabels();
    const statusPath = getTagPaths(tagLabels).status;
    const counts = new Map<string, { expiring: number; expired: number }>();
    const labels: Array<{ label: string; status?: UsageRightsStatus }> = [
      ...(['valid', 'restricted', 'expiring', 'unreviewed'] as const).map((status) => ({
        label: tagLabels.statuses[status],
        status,
      })),
      ...Object.values(tagLabels.legacyStatuses)
        .filter((label) => label !== undefined)
        .map((label) => ({ label })),
    ];

    for (const user of await this.userRepository.getList()) {
      for (const { label, status } of labels) {
        const tag = await this.tagRepository.getByValue(user.id, `${statusPath}/${label}`);
        if (!tag) {
          continue;
        }

        for (const assetId of await this.tagRepository.getAssetIdsByTagId(tag.id)) {
          const rights = await this.getUsageRights(assetId);
          if (status && rights && getUsageRightsStatus(rights, today) === status) {
            continue;
          }

          const result = await this.syncTags(assetId, today);
          if (!result || result.previous === result.current) {
            continue;
          }

          if (result.current !== 'expiring' && result.current !== 'expired') {
            continue;
          }

          const count = counts.get(result.ownerId) ?? { expiring: 0, expired: 0 };
          count[result.current]++;
          counts.set(result.ownerId, count);
        }

        if (!status) {
          await this.tagRepository.delete(tag.id);
        }
      }
    }

    for (const [userId, count] of counts) {
      await this.notify(userId, count);
    }
  }

  private async notify(userId: string, { expiring, expired }: { expiring: number; expired: number }) {
    const tagLabels = getTagLabels();
    const lines = [
      expired > 0 ? formatMessage(tagLabels.notificationExpired, { count: expired }) : '',
      expiring > 0 ? formatMessage(tagLabels.notificationExpiring, { count: expiring, days: EXPIRING_SOON_DAYS }) : '',
    ].filter(Boolean);

    const item = await this.notificationRepository.create({
      userId,
      type: NotificationType.Custom,
      level: expired > 0 ? NotificationLevel.Warning : NotificationLevel.Info,
      title: tagLabels.notificationTitle,
      description: lines.join(' '),
    });
    this.websocketRepository.clientSend('on_notification', userId, mapNotification(item));
  }
}
