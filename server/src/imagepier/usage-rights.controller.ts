import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { Permission } from 'src/enum.js';
import { getCachedAccessSettings } from 'src/imagepier/access-rules.js';
import { recordAuditFor } from 'src/imagepier/audit.js';
import { ImagePierUsageRightsService } from 'src/imagepier/usage-rights.service.js';
import { Auth, Authenticated } from 'src/middleware/auth.guard.js';

const UsageRightsSyncSchema = z.object({
  assetIds: z.array(z.uuidv4()).min(1).max(10_000).describe('Asset IDs whose usage rights tags should be updated'),
});

class UsageRightsSyncDto extends createZodDto(UsageRightsSyncSchema) {}

const MoveToLibrarySchema = z.object({
  assetIds: z.array(z.uuidv4()).min(1).max(10_000).describe('Own assets or media library assets'),
  areaId: z.string().min(1).describe('Area of the media library'),
});

class MoveToLibraryDto extends createZodDto(MoveToLibrarySchema) {}

/** ImagePier endpoints. Not part of Immich's public API specification. */
@ApiExcludeController()
@Controller('imagepier/usage-rights')
export class ImagePierUsageRightsController {
  constructor(private service: ImagePierUsageRightsService) {}

  @Get('config')
  @Authenticated()
  getConfig() {
    return this.service.getUsageRightsConfig();
  }

  @Get('library-tags')
  @Authenticated()
  getLibraryTags(@Auth() auth: AuthDto) {
    return this.service.getLibraryTags(auth);
  }

  @Post('sync')
  @Authenticated({ permission: Permission.AssetUpdate })
  @HttpCode(HttpStatus.NO_CONTENT)
  async syncTags(@Auth() auth: AuthDto, @Body() dto: UsageRightsSyncDto): Promise<void> {
    await this.service.syncTagsForAssets(auth, dto.assetIds);
    recordAuditFor(auth, { action: 'usage_rights', assetIds: dto.assetIds });
  }

  @Post('library')
  @Authenticated({ permission: Permission.AssetUpdate })
  @HttpCode(HttpStatus.OK)
  async moveToLibrary(@Auth() auth: AuthDto, @Body() dto: MoveToLibraryDto) {
    const result = await this.service.moveToLibrary(auth, dto.assetIds, dto.areaId);
    const area = getCachedAccessSettings().areas.find((item) => item.id === dto.areaId)?.name;
    recordAuditFor(auth, { action: 'library_move', assetIds: dto.assetIds, details: { areaId: dto.areaId, area } });
    return result;
  }
}
