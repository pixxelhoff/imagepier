import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Next,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { NextFunction, Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { recordAuditFor } from 'src/imagepier/audit.js';
import { MAX_LOGO_LENGTH } from 'src/imagepier/gallery.js';
import { ImagePierGalleryService } from 'src/imagepier/gallery.service.js';
import { Auth, Authenticated, FileResponse } from 'src/middleware/auth.guard.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';
import { sendFile } from 'src/utils/file.js';
import { UUIDParamDto } from 'src/validation.js';

const GalleryKeyParamSchema = z.object({
  key: z.string().min(16).max(64).describe('Gallery key'),
});

class GalleryKeyParamDto extends createZodDto(GalleryKeyParamSchema) {}

const GalleryAssetParamSchema = z.object({
  key: z.string().min(16).max(64).describe('Gallery key'),
  id: z.uuid().describe('Asset ID'),
});

class GalleryAssetParamDto extends createZodDto(GalleryAssetParamSchema) {}

const GalleryAssetQuerySchema = z.object({
  size: z.enum(['thumbnail', 'preview']).default('thumbnail').describe('Image size'),
});

class GalleryAssetQueryDto extends createZodDto(GalleryAssetQuerySchema) {}

const GalleryCreateSchema = z.object({
  albumId: z.uuid().describe('Album to publish'),
  title: z.string().trim().min(1).max(100).describe('Title shown on the gallery page'),
  allowDownload: z.boolean().default(true).describe('Whether visitors can download originals'),
});

class GalleryCreateDto extends createZodDto(GalleryCreateSchema) {}

const GalleryBrandingSchema = z.object({
  title: z.string().max(100).optional().describe('Heading of all galleries'),
  color: z.string().max(7).optional().describe('Accent color, e.g. #0055a4'),
  logo: z.string().max(MAX_LOGO_LENGTH).optional().describe('Logo as data URL'),
  footer: z.string().max(1000).optional().describe('Text below the gallery'),
  imprintUrl: z.string().max(500).optional().describe('Link to the imprint'),
  privacyUrl: z.string().max(500).optional().describe('Link to the privacy policy'),
});

class GalleryBrandingDto extends createZodDto(GalleryBrandingSchema) {}

/** Public gallery pages. Not part of Immich's public API specification. */
@ApiExcludeController()
@Controller('imagepier/gallery')
export class ImagePierGalleryPublicController {
  constructor(
    private logger: LoggingRepository,
    private service: ImagePierGalleryService,
  ) {}

  @Get(':key')
  @Authenticated({ public: true })
  getGallery(@Param() { key }: GalleryKeyParamDto) {
    return this.service.getPublicGallery(key);
  }

  @Get(':key/assets/:id')
  @FileResponse()
  @Authenticated({ public: true })
  async viewAsset(
    @Param() { key, id }: GalleryAssetParamDto,
    @Query() { size }: GalleryAssetQueryDto,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    await sendFile(res, next, () => this.service.viewAsset(key, id, size), this.logger);
  }

  @Get(':key/assets/:id/download')
  @FileResponse()
  @Authenticated({ public: true })
  async downloadAsset(@Param() { key, id }: GalleryAssetParamDto, @Res() res: Response, @Next() next: NextFunction) {
    await sendFile(res, next, () => this.service.downloadAsset(key, id), this.logger);
  }
}

/** Gallery management for administrators and media managers. */
@ApiExcludeController()
@Controller('imagepier/galleries')
export class ImagePierGalleryController {
  constructor(private service: ImagePierGalleryService) {}

  @Get()
  @Authenticated()
  getGalleries(@Auth() auth: AuthDto) {
    return this.service.getGalleries(auth);
  }

  @Post()
  @Authenticated()
  async createGallery(@Auth() auth: AuthDto, @Body() dto: GalleryCreateDto) {
    const gallery = await this.service.createGallery(auth, dto);
    recordAuditFor(auth, { action: 'gallery', details: { gallery: gallery.title, published: true } });
    return gallery;
  }

  @Delete(':id')
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGallery(@Auth() auth: AuthDto, @Param() { id }: UUIDParamDto) {
    const gallery = await this.service.deleteGallery(auth, id);
    recordAuditFor(auth, { action: 'gallery', details: { gallery: gallery.title, published: false } });
  }
}

/** Gallery branding, only for administrators. */
@ApiExcludeController()
@Controller('admin/imagepier/gallery')
export class ImagePierGalleryAdminController {
  constructor(private service: ImagePierGalleryService) {}

  @Get('branding')
  @Authenticated({ admin: true })
  getBranding() {
    return this.service.getBranding();
  }

  @Put('branding')
  @Authenticated({ admin: true })
  updateBranding(@Body() dto: GalleryBrandingDto) {
    return this.service.updateBranding(dto);
  }
}
