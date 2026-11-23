import { Body, Controller, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { Permission } from 'src/enum.js';
import { ImagePierKeywordService } from 'src/imagepier/keyword.service.js';
import { MAX_KEYWORDS } from 'src/imagepier/keywords.js';
import { Auth, Authenticated } from 'src/middleware/auth.guard.js';
import { UUIDParamDto } from 'src/validation.js';

const KeywordSchema = z.object({
  category: z.string().max(100),
  name: z.string().max(100),
  description: z.string().max(500).optional(),
  active: z.boolean(),
});

const KeywordListSchema = z.object({
  keywords: z.array(KeywordSchema).max(MAX_KEYWORDS).describe('Complete keyword list'),
});

class KeywordListDto extends createZodDto(KeywordListSchema) {}

const AssetKeywordsSchema = z.object({
  assetIds: z.array(z.uuidv4()).min(1).max(10_000).describe('Assets to change'),
  add: z.array(z.string().max(201)).max(MAX_KEYWORDS).describe('Keywords (Category/Keyword) to add'),
  remove: z.array(z.string().max(201)).max(MAX_KEYWORDS).describe('Keywords (Category/Keyword) to remove'),
});

class AssetKeywordsDto extends createZodDto(AssetKeywordsSchema) {}

/** ImagePier keyword endpoints. Not part of Immich's public API specification. */
@ApiExcludeController()
@Controller('imagepier/keywords')
export class ImagePierKeywordController {
  constructor(private service: ImagePierKeywordService) {}

  @Get()
  @Authenticated()
  async getKeywords() {
    return { keywords: await this.service.getKeywords() };
  }

  @Get('tags')
  @Authenticated()
  async getKeywordTags(@Auth() auth: AuthDto) {
    return { tags: await this.service.getKeywordTags(auth) };
  }

  @Get('assets/:id')
  @Authenticated({ permission: Permission.AssetRead })
  async getAssetKeywords(@Auth() auth: AuthDto, @Param() { id }: UUIDParamDto) {
    return { values: await this.service.getAssetKeywords(auth, id) };
  }

  @Put('assets')
  @Authenticated({ permission: Permission.AssetUpdate })
  @HttpCode(HttpStatus.OK)
  updateAssetKeywords(@Auth() auth: AuthDto, @Body() dto: AssetKeywordsDto) {
    return this.service.updateAssetKeywords(auth, dto);
  }
}

/** Admin endpoints for the keyword list (kept under admin/ like all admin-only routes). */
@ApiExcludeController()
@Controller('admin/imagepier/keywords')
export class ImagePierKeywordAdminController {
  constructor(private service: ImagePierKeywordService) {}

  @Put()
  @Authenticated({ admin: true })
  async updateKeywords(@Body() dto: KeywordListDto) {
    return { keywords: await this.service.updateKeywords(dto.keywords) };
  }
}
