import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { Permission } from 'src/enum.js';
import { getCachedAccessSettings } from 'src/imagepier/access-rules.js';
import { recordAuditFor } from 'src/imagepier/audit.js';
import { MAX_CHANNELS } from 'src/imagepier/channels.js';
import { ImagePierUsageRightsService } from 'src/imagepier/usage-rights.service.js';
import { Auth, Authenticated } from 'src/middleware/auth.guard.js';

const UsageRightsSyncSchema = z.object({
  assetIds: z.array(z.uuidv4()).min(1).max(10_000).describe('Asset IDs whose usage rights tags should be updated'),
  confirmed: z.boolean().optional().describe('Whether the usage rights were confirmed (audit log)'),
});

class UsageRightsSyncDto extends createZodDto(UsageRightsSyncSchema) {}

const MoveToLibrarySchema = z.object({
  assetIds: z.array(z.uuidv4()).min(1).max(10_000).describe('Own assets or media library assets'),
  areaId: z.string().min(1).describe('Area of the media library'),
});

class MoveToLibraryDto extends createZodDto(MoveToLibrarySchema) {}

const ChannelListSchema = z.object({
  channels: z
    .array(
      z.object({
        id: z.string().max(40).optional(),
        label: z.string().max(60),
        active: z.boolean(),
        gallery: z.boolean().optional(),
      }),
    )
    .max(MAX_CHANNELS)
    .describe('Complete channel list'),
});

class ChannelListDto extends createZodDto(ChannelListSchema) {}

const DownloadCheckSchema = z.object({
  assetIds: z.array(z.uuidv4()).min(1).max(10_000).describe('Assets the user wants to download'),
});

class DownloadCheckDto extends createZodDto(DownloadCheckSchema) {}

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

  @Get('channels')
  @Authenticated()
  async getChannels() {
    return { channels: await this.service.getChannels() };
  }

  /** Assets among the given ones that the user may not download (blocked, or no download level in the area). */
  @Post('download-check')
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  async checkDownload(@Auth() auth: AuthDto, @Body() dto: DownloadCheckDto) {
    return { deniedAssetIds: await this.service.getDeniedDownloads(auth, dto.assetIds) };
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
    recordAuditFor(auth, { action: dto.confirmed ? 'usage_rights_confirm' : 'usage_rights', assetIds: dto.assetIds });
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

/** Admin endpoints for the channel list (kept under admin/ like all admin-only routes). */
@ApiExcludeController()
@Controller('admin/imagepier/channels')
export class ImagePierChannelAdminController {
  constructor(private service: ImagePierUsageRightsService) {}

  @Put()
  @Authenticated({ admin: true })
  async updateChannels(@Body() dto: ChannelListDto) {
    return { channels: await this.service.updateChannels(dto.channels) };
  }
}
