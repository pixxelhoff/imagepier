import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { AUDIT_ACTIONS, MAX_RETENTION_DAYS, MIN_RETENTION_DAYS } from 'src/imagepier/audit.js';
import { ImagePierAuditService } from 'src/imagepier/audit.service.js';
import { Auth, Authenticated } from 'src/middleware/auth.guard.js';

const AuditListQuerySchema = z.object({
  from: z.coerce.date().optional().describe('Earliest entry'),
  to: z.coerce.date().optional().describe('Latest entry'),
  userId: z.uuid().optional().describe('Only entries of this user'),
  action: z.enum(AUDIT_ACTIONS).optional().describe('Only entries of this action'),
  limit: z.coerce.number().int().min(1).max(10_000).default(100).describe('Number of entries'),
  offset: z.coerce.number().int().min(0).default(0).describe('Entries to skip'),
});

class AuditListQueryDto extends createZodDto(AuditListQuerySchema) {}

const AuditSettingsUpdateSchema = z.object({
  retentionDays: z
    .number()
    .int()
    .min(MIN_RETENTION_DAYS)
    .max(MAX_RETENTION_DAYS)
    .optional()
    .describe('Days the entries are kept'),
  downloadsWithUser: z.boolean().optional().describe('Store who downloaded an asset'),
  logins: z.boolean().optional().describe('Store logins'),
});

class AuditSettingsUpdateDto extends createZodDto(AuditSettingsUpdateSchema) {}

/** ImagePier admin endpoints. Not part of Immich's public API specification. */
@ApiExcludeController()
@Controller('admin/imagepier')
export class ImagePierAuditAdminController {
  constructor(private service: ImagePierAuditService) {}

  @Get('audit')
  @Authenticated({ admin: true })
  getAuditLog(@Query() dto: AuditListQueryDto) {
    return this.service.list(dto);
  }

  @Get('audit/users')
  @Authenticated({ admin: true })
  getAuditUsers() {
    return this.service.getUsers();
  }

  @Get('audit/settings')
  @Authenticated({ admin: true })
  getAuditSettings() {
    return this.service.getSettings();
  }

  @Put('audit/settings')
  @Authenticated({ admin: true })
  updateAuditSettings(@Body() dto: AuditSettingsUpdateDto) {
    return this.service.updateSettings(dto);
  }
}

/** ImagePier endpoints. Not part of Immich's public API specification. */
@ApiExcludeController()
@Controller('imagepier/library')
export class ImagePierLibraryController {
  constructor(private service: ImagePierAuditService) {}

  /** Trash of the areas where the user is editor or media manager. */
  @Get('trash')
  @Authenticated()
  getLibraryTrash(@Auth() auth: AuthDto) {
    return this.service.getLibraryTrash(auth);
  }
}
