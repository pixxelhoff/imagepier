import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { JobName, Permission, SystemMetadataKey } from 'src/enum.js';
import {
  KEYWORDS_KEY,
  Keyword,
  getKeywordValue,
  normalizeKeywords,
  parseKeywordSettings,
} from 'src/imagepier/keywords.js';
import { getTagLabels, getTagPaths } from 'src/imagepier/usage-rights-tags.js';
import { BaseService } from 'src/services/base.service.js';
import type { SystemMetadata } from 'src/types.js';
import { updateLockedColumns } from 'src/utils/database.js';
import { upsertTags } from 'src/utils/tag.js';

const settingsKey = KEYWORDS_KEY as SystemMetadataKey;

export type AssetKeywordsUpdate = { assetIds: string[]; add: string[]; remove: string[] };

/**
Keyword list (controlled vocabulary) and keywords of assets.

Keywords are stored as Immich tags of the asset owner, like Immich does when tags are added in the web app:
the tags are also written to the asset's metadata (locked) and its XMP sidecar, so a new metadata extraction
keeps them.
*/
@Injectable()
export class ImagePierKeywordService extends BaseService {
  async getKeywords(): Promise<Keyword[]> {
    return parseKeywordSettings(await this.systemMetadataRepository.get(settingsKey));
  }

  async updateKeywords(items: unknown[]): Promise<Keyword[]> {
    const keywords = normalizeKeywords(items);
    await this.systemMetadataRepository.set(settingsKey, { keywords } as unknown as SystemMetadata[SystemMetadataKey]);
    return keywords;
  }

  async getAssetKeywords(auth: AuthDto, assetId: string): Promise<string[]> {
    await this.requireAccess({ auth, permission: Permission.AssetRead, ids: [assetId] });
    const known = new Set((await this.getKeywords()).map((keyword) => getKeywordValue(keyword)));
    const asset = await this.assetRepository.getById(assetId, { tags: true });
    return (asset?.tags ?? []).map((tag) => tag.value).filter((value) => known.has(value));
  }

  /** Adds and removes keywords; only active keywords of the list can be added. */
  async updateAssetKeywords(auth: AuthDto, { assetIds, add, remove }: AssetKeywordsUpdate) {
    await this.requireAccess({ auth, permission: Permission.AssetUpdate, ids: assetIds });

    const keywords = await this.getKeywords();
    const active = new Set(keywords.filter((keyword) => keyword.active).map((keyword) => getKeywordValue(keyword)));
    const known = new Set(keywords.map((keyword) => getKeywordValue(keyword)));
    if (add.some((value) => !active.has(value))) {
      throw new BadRequestException('Unknown or inactive keyword');
    }

    const removed = new Set(remove.filter((value) => known.has(value)));
    const assets = await this.assetRepository.getByIds(assetIds);
    for (const { id, ownerId } of assets) {
      const current = (await this.assetRepository.getById(id, { tags: true }))?.tags ?? [];
      for (const tag of current) {
        if (removed.has(tag.value)) {
          await this.tagRepository.removeAssetIds(tag.id, [id]);
        }
      }

      const tags = await upsertTags(this.tagRepository, { userId: ownerId, tags: add });
      await this.tagRepository.upsertAssetIds(tags.map((tag) => ({ assetId: id, tagId: tag.id })));
      await this.updateExifTags(id);
    }

    await this.jobRepository.queueAll(assets.map(({ id }) => ({ name: JobName.SidecarWrite, data: { id } })));
    return { count: assets.length };
  }

  /** Same as Immich's tag service; usage rights tags are left out, ImagePier derives them from the usage rights. */
  private async updateExifTags(assetId: string) {
    const usageRightsPrefix = `${getTagPaths(getTagLabels()).root}/`;
    const { tags } = await this.assetRepository.getForUpdateTags(assetId);
    const values = tags.map(({ value }) => value).filter((value) => !value.startsWith(usageRightsPrefix));
    await this.assetRepository.upsertExif({
      exif: updateLockedColumns({ assetId, tags: values }),
      lockedPropertiesBehavior: 'append',
    });
  }
}
