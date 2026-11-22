import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { OnEvent } from 'src/decorators.js';
import { AuthDto } from 'src/dtos/auth.dto.js';
import { mapNotification } from 'src/dtos/notification.dto.js';
import { ImmichWorker, NotificationLevel, NotificationType, Permission, SystemMetadataKey } from 'src/enum.js';
import { getAccessForAuth } from 'src/imagepier/access-hook.js';
import {
  ACCESS_SETTINGS_KEY,
  ASSET_AREA_KEY,
  canEditArea,
  getAreaAccounts,
  getAreaLevel,
  getAreaOfOwner,
  getCachedAccessSettings,
  getSharedAreaName,
  parseAccessSettings,
  parseAssetArea,
} from 'src/imagepier/access-rules.js';
import { setAreaAssetMigration } from 'src/imagepier/access.service.js';
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
import { USAGE_RIGHTS_KEY, UsageRights, parseUsageRights, suggestUsageRights } from 'src/imagepier/usage-rights.js';
import type { ArgOf } from 'src/repositories/event.repository.js';
import { BaseService } from 'src/services/base.service.js';
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
    setAreaAssetMigration(() => this.migrateAreaAssets());
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

  async getUsageRights(assetId: string): Promise<UsageRights | undefined> {
    const item = await this.assetRepository.getMetadataByKey(assetId, USAGE_RIGHTS_KEY);
    return item ? parseUsageRights(item.value) : undefined;
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
    const desiredValues = getUsageRightsTagValues(rights, today, tagLabels, areaName);
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
      await this.requireAccess({ auth, permission: Permission.AssetUpdate, ids: libraryIds });
    }

    // All assets are own or media library assets (checked above).
    const moveIds = assets.filter((asset) => asset.ownerId !== target.userId).map((asset) => asset.id);
    if (moveIds.length > 0) {
      await this.assetRepository.updateAll(moveIds, { ownerId: target.userId });
    }

    for (const assetId of [...ownIds, ...libraryIds]) {
      await this.assetRepository.upsertMetadata(assetId, [{ key: ASSET_AREA_KEY, value: { areaId } }]);
      await this.syncTags(assetId);
    }

    return { count: ownIds.length + libraryIds.length };
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
    for (const assetId of assetIds) {
      const asset = await this.assetRepository.getById(assetId);
      const item = await this.assetRepository.getMetadataByKey(assetId, ASSET_AREA_KEY);
      const area = settings.areas.find(({ id }) => id === parseAssetArea(item?.value));
      if (!asset || asset.ownerId !== libraryUserId || !area?.userId || area.userId === libraryUserId) {
        continue;
      }

      await this.assetRepository.updateAll([assetId], { ownerId: area.userId });
      await this.syncTags(assetId);
      count++;
    }
    return count;
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

  /** Re-evaluates the status of all assets that are not expired yet and notifies their owners. */
  async refreshStatuses(today = new Date()) {
    const tagLabels = getTagLabels();
    const statusPath = getTagPaths(tagLabels).status;
    const counts = new Map<string, { expiring: number; expired: number }>();

    for (const user of await this.userRepository.getList()) {
      for (const status of ['valid', 'expiring', 'unreviewed'] as const) {
        const tag = await this.tagRepository.getByValue(user.id, `${statusPath}/${tagLabels.statuses[status]}`);
        if (!tag) {
          continue;
        }

        for (const assetId of await this.tagRepository.getAssetIdsByTagId(tag.id)) {
          const rights = await this.getUsageRights(assetId);
          if (rights && getUsageRightsStatus(rights, today) === status) {
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
