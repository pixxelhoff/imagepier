import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { JobName, Permission, SystemMetadataKey } from 'src/enum.js';
import { getAccessForAuth } from 'src/imagepier/access-hook.js';
import { getAreaLevel, getCachedAccessSettings } from 'src/imagepier/access-rules.js';
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

export type KeywordInput = { category: string; name: string; description?: string; active?: boolean };

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

  /** Adds one active keyword to the list. */
  async addKeyword(input: KeywordInput): Promise<Keyword[]> {
    const keywords = await this.getKeywords();
    const keyword = this.toKeyword({ ...input, active: true });
    this.requireUnique(keywords, getKeywordValue(keyword));
    return this.updateKeywords([...keywords, keyword]);
  }

  /**
  Changes a keyword of the list. A new category or name renames the keyword tags of all accounts, so every asset
  keeps its keyword.
  */
  async editKeyword(value: string, input: KeywordInput): Promise<Keyword[]> {
    const keywords = await this.getKeywords();
    const index = keywords.findIndex((keyword) => getKeywordValue(keyword) === value);
    if (index === -1) {
      throw new NotFoundException('Keyword not found');
    }

    const keyword = this.toKeyword({ ...input, active: input.active ?? keywords[index].active });
    const newValue = getKeywordValue(keyword);
    if (newValue.toLowerCase() !== value.toLowerCase()) {
      this.requireUnique(keywords, newValue);
    }
    if (newValue !== value) {
      await this.renameKeywordTags(value, newValue);
    }

    return this.updateKeywords(keywords.map((item, itemIndex) => (itemIndex === index ? keyword : item)));
  }

  /** Removes a keyword from the list; only possible while it is not assigned to any asset. */
  async deleteKeyword(value: string): Promise<Keyword[]> {
    const keywords = await this.getKeywords();
    if (keywords.every((keyword) => getKeywordValue(keyword) !== value)) {
      throw new NotFoundException('Keyword not found');
    }

    const tags = await this.getTagsOfAllAccounts(value);
    let count = 0;
    for (const tag of tags) {
      const assetIds = await this.tagRepository.getAssetIdsByTagId(tag.id);
      count += assetIds.length;
    }
    if (count > 0) {
      // `code` and `count` let the web app show a translated message.
      throw new BadRequestException({
        message: `The keyword is still assigned to ${count} assets; deactivate it instead`,
        code: 'keyword_in_use',
        count,
      });
    }
    for (const tag of tags) {
      await this.tagRepository.delete(tag.id);
    }

    return this.updateKeywords(keywords.filter((keyword) => getKeywordValue(keyword) !== value));
  }

  async getAssetKeywords(auth: AuthDto, assetId: string): Promise<string[]> {
    await this.requireAccess({ auth, permission: Permission.AssetRead, ids: [assetId] });
    const keywords = await this.getKeywords();
    const known = new Set(keywords.map((keyword) => getKeywordValue(keyword)));
    const asset = await this.assetRepository.getById(assetId, { tags: true });
    return (asset?.tags ?? []).map((tag) => tag.value).filter((value) => known.has(value));
  }

  /**
  Keyword tags of the own account and of the areas the user has a level in. The search sends the tags of all
  accounts; tags with the same value count as one tag (see hasTags in src/utils/database.ts).
  */
  async getKeywordTags(auth: AuthDto) {
    const keywords = await this.getKeywords();
    const known = new Set(keywords.map((keyword) => getKeywordValue(keyword)));
    const access = getAccessForAuth(auth);
    const areaAccounts = getCachedAccessSettings().areas.flatMap((area) =>
      area.userId && getAreaLevel(access, area.id) ? area.userId : [],
    );

    const result: Array<{ id: string; value: string }> = [];
    for (const userId of new Set([auth.user.id, ...areaAccounts])) {
      for (const tag of await this.tagRepository.getAll(userId)) {
        if (known.has(tag.value)) {
          result.push({ id: tag.id, value: tag.value });
        }
      }
    }
    return result;
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
      const asset = await this.assetRepository.getById(id, { tags: true });
      for (const tag of asset?.tags ?? []) {
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

  private toKeyword(input: KeywordInput): Keyword {
    const [keyword] = normalizeKeywords([input]);
    if (!keyword) {
      throw new BadRequestException('Category and keyword are required');
    }
    return keyword;
  }

  private requireUnique(keywords: Keyword[], value: string) {
    if (keywords.some((keyword) => getKeywordValue(keyword).toLowerCase() === value.toLowerCase())) {
      throw new BadRequestException('The keyword already exists');
    }
  }

  /** Tags with this value of all accounts (own accounts and area accounts). */
  private async getTagsOfAllAccounts(value: string) {
    const tags: Array<{ id: string; userId: string }> = [];
    for (const user of await this.userRepository.getList({ withDeleted: true })) {
      const tag = await this.tagRepository.getByValue(user.id, value);
      if (tag) {
        tags.push({ id: tag.id, userId: user.id });
      }
    }
    return tags;
  }

  /**
  Moves the assets of every tag `from` to the tag `to` of the same account and deletes the old tag. Empty parent tags
  (an old category) are removed by Immich's nightly tag cleanup.
  */
  private async renameKeywordTags(from: string, to: string) {
    const changed = new Set<string>();
    for (const tag of await this.getTagsOfAllAccounts(from)) {
      const assetIds = await this.tagRepository.getAssetIdsByTagId(tag.id);
      const [target] = await upsertTags(this.tagRepository, { userId: tag.userId, tags: [to] });
      await this.tagRepository.upsertAssetIds(assetIds.map((assetId) => ({ assetId, tagId: target.id })));
      await this.tagRepository.delete(tag.id);
      for (const assetId of assetIds) {
        await this.updateExifTags(assetId);
        changed.add(assetId);
      }
    }

    await this.jobRepository.queueAll([...changed].map((id) => ({ name: JobName.SidecarWrite, data: { id } })));
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
