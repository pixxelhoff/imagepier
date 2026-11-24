import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { Permission } from 'src/enum.js';
import { getCachedAccessSettings } from 'src/imagepier/access-rules.js';
import { recordAuditFor } from 'src/imagepier/audit.js';
import { ImagePierKeywordService } from 'src/imagepier/keyword.service.js';
import { MAX_KEYWORDS } from 'src/imagepier/keywords.js';
import { ImagePierUsageRightsService } from 'src/imagepier/usage-rights.service.js';
import { Auth, Authenticated } from 'src/middleware/auth.guard.js';

const ImportSchema = z.object({
  assetIds: z.array(z.uuidv4()).min(1).max(1000).describe('Assets uploaded with the regular upload endpoint'),
  areaId: z.string().min(1).optional().describe('Area of the media library the assets are added to'),
  keywords: z
    .array(z.string().max(201))
    .max(MAX_KEYWORDS)
    .optional()
    .describe('Keywords (Category/Keyword) from the keyword list'),
  usageRights: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Usage rights fields, merged into existing usage rights (see usage-rights.ts)'),
});

class ImportDto extends createZodDto(ImportSchema) {}

/**
ImagePier import endpoint for tools that upload many assets (not part of Immich's public API specification).

A tool uploads the files with Immich's regular upload endpoint (`POST /api/assets`) and then calls this endpoint
once per batch: the assets are added to the area, get their keywords and their usage rights. All steps use the
regular permission checks of the user the API key belongs to.
*/
@ApiExcludeController()
@Controller('imagepier/import')
export class ImagePierImportController {
  constructor(
    private usageRightsService: ImagePierUsageRightsService,
    private keywordService: ImagePierKeywordService,
  ) {}

  @Post()
  @Authenticated({ permission: Permission.AssetUpdate })
  @HttpCode(HttpStatus.OK)
  async importAssets(@Auth() auth: AuthDto, @Body() dto: ImportDto) {
    const { assetIds, areaId, keywords, usageRights } = dto;

    // The area comes first, so the release status follows the rules of the area.
    if (areaId) {
      await this.usageRightsService.moveToLibrary(auth, assetIds, areaId);
      const area = getCachedAccessSettings().areas.find((item) => item.id === areaId)?.name;
      recordAuditFor(auth, { action: 'library_move', assetIds, details: { areaId, area } });
    }

    if (keywords && keywords.length > 0) {
      await this.keywordService.updateAssetKeywords(auth, { assetIds, add: keywords, remove: [] });
    }

    if (usageRights) {
      await this.usageRightsService.importUsageRights(auth, assetIds, usageRights);
      recordAuditFor(auth, { action: 'usage_rights', assetIds });
    }

    return { count: assetIds.length };
  }
}
