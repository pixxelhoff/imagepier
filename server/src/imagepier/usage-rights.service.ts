import { Injectable } from '@nestjs/common';
import { OnEvent } from 'src/decorators.js';
import { USAGE_RIGHTS_KEY, suggestUsageRights } from 'src/imagepier/usage-rights.js';
import type { ArgOf } from 'src/repositories/event.repository.js';
import { BaseService } from 'src/services/base.service.js';

/**
Pre-fills usage rights (photographer, copyright holder, credit line) for new assets.

Runs after Immich extracted the metadata of an asset. Existing usage rights are
never overwritten, so manual edits survive a metadata re-extraction.
*/
@Injectable()
export class ImagePierUsageRightsService extends BaseService {
  @OnEvent({ name: 'AssetMetadataExtracted' })
  async onAssetMetadataExtracted({ assetId }: ArgOf<'AssetMetadataExtracted'>) {
    try {
      await this.suggestForAsset(assetId);
    } catch (error) {
      this.logger.warn(`Unable to suggest usage rights for asset ${assetId}: ${error}`);
    }
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
}
