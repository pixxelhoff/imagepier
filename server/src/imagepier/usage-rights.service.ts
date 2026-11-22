import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { OnEvent } from 'src/decorators.js';
import { AuthDto } from 'src/dtos/auth.dto.js';
import { mapNotification } from 'src/dtos/notification.dto.js';
import { ImmichWorker, NotificationLevel, NotificationType, Permission } from 'src/enum.js';
import { getAccessForAuth } from 'src/imagepier/access-hook.js';
import {
  ASSET_AREA_KEY,
  SHARED_AREA_ID,
  canEditArea,
  getCachedAccessSettings,
  parseAssetArea,
} from 'src/imagepier/access-rules.js';
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
    const areaName = await this.getAreaName(assetId, asset.ownerId);
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

  /** Name of the area of a media library asset; assets without area belong to the shared area. */
  private async getAreaName(assetId: string, ownerId: string) {
    const { libraryUserId, areas } = getCachedAccessSettings();
    if (!libraryUserId || ownerId !== libraryUserId) {
      return;
    }

    const item = await this.assetRepository.getMetadataByKey(assetId, ASSET_AREA_KEY);
    const areaId = parseAssetArea(item?.value) ?? SHARED_AREA_ID;
    return (areas.find((area) => area.id === areaId) ?? areas.find((area) => area.id === SHARED_AREA_ID))?.name;
  }

  /**
  Moves own assets into the media library and sets the area of the given assets.
  Media library assets can be given another area if the user may edit them.
  */
  async moveToLibrary(auth: AuthDto, assetIds: string[], areaId: string) {
    const { libraryUserId, areas } = getCachedAccessSettings();
    if (!libraryUserId) {
      throw new BadRequestException('The media library is not set up');
    }

    if (areas.every((area) => area.id !== areaId)) {
      throw new BadRequestException('Unknown area');
    }

    const access = getAccessForAuth(auth);
    if (!access.canViewLibrary || (access.role === 'manager' && !canEditArea(access, areaId))) {
      throw new ForbiddenException('No access to this area');
    }

    const assets = await this.assetRepository.getByIds(assetIds);
    const ownIds = assets.filter((asset) => asset.ownerId === auth.user.id).map((asset) => asset.id);
    const libraryIds = assets
      .filter((asset) => asset.ownerId === libraryUserId && asset.ownerId !== auth.user.id)
      .map((asset) => asset.id);
    if (ownIds.length + libraryIds.length !== new Set(assetIds).size) {
      throw new BadRequestException('Not found or no access');
    }

    if (libraryIds.length > 0) {
      await this.requireAccess({ auth, permission: Permission.AssetUpdate, ids: libraryIds });
    }

    if (ownIds.length > 0) {
      if (!access.canUpload) {
        throw new ForbiddenException('No permission to add assets to the media library');
      }
      await this.assetRepository.updateAll(ownIds, { ownerId: libraryUserId });
    }

    for (const assetId of [...ownIds, ...libraryIds]) {
      await this.assetRepository.upsertMetadata(assetId, [{ key: ASSET_AREA_KEY, value: { areaId } }]);
      await this.syncTags(assetId);
    }

    return { count: ownIds.length + libraryIds.length };
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
