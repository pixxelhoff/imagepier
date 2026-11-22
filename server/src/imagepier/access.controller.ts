import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { ASSIGNABLE_ROLES, getCachedAccessSettings } from 'src/imagepier/access-rules.js';
import { ImagePierAccessService } from 'src/imagepier/access.service.js';
import { recordAuditFor } from 'src/imagepier/audit.js';
import { Auth, Authenticated } from 'src/middleware/auth.guard.js';
import { UUIDParamDto } from 'src/validation.js';

const UserAccessUpdateSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES).optional().describe('ImagePier role'),
  canUpload: z.boolean().optional().describe('Whether the user can upload assets'),
  canDownload: z.boolean().optional().describe('Whether the user can download assets'),
  areas: z.array(z.string().min(1)).max(100).optional().describe('Areas of a media manager'),
});

class UserAccessUpdateDto extends createZodDto(UserAccessUpdateSchema) {}

const AreasUpdateSchema = z.object({
  areas: z
    .array(
      z.object({
        id: z.string().min(1).optional().describe('Area id; omit to create an area'),
        name: z.string().min(1).max(100).describe('Area name'),
      }),
    )
    .max(100)
    .describe('All areas; areas that are not listed are removed'),
});

class AreasUpdateDto extends createZodDto(AreasUpdateSchema) {}

/** ImagePier endpoints. Not part of Immich's public API specification. */
@ApiExcludeController()
@Controller('imagepier/access')
export class ImagePierAccessController {
  constructor(private service: ImagePierAccessService) {}

  @Get('me')
  @Authenticated()
  getMyAccess(@Auth() auth: AuthDto) {
    return this.service.getMyAccess(auth);
  }
}

/** ImagePier admin endpoints. Not part of Immich's public API specification. */
@ApiExcludeController()
@Controller('admin/imagepier/access')
export class ImagePierAccessAdminController {
  constructor(private service: ImagePierAccessService) {}

  @Get('areas')
  @Authenticated({ admin: true })
  getAreas() {
    return this.service.getAreas();
  }

  @Put('areas')
  @Authenticated({ admin: true })
  async updateAreas(@Auth() auth: AuthDto, @Body() dto: AreasUpdateDto) {
    const areas = await this.service.updateAreas(dto.areas);
    recordAuditFor(auth, { action: 'areas', details: { areas: areas.map((area) => area.name) } });
    return areas;
  }

  @Get('users/:id')
  @Authenticated({ admin: true })
  getUserAccess(@Param() { id }: UUIDParamDto) {
    return this.service.getUserAccessAdmin(id);
  }

  @Put('users/:id')
  @Authenticated({ admin: true })
  async updateUserAccess(@Auth() auth: AuthDto, @Param() { id }: UUIDParamDto, @Body() dto: UserAccessUpdateDto) {
    const result = await this.service.updateUserAccessAdmin(id, dto);
    const { areas } = getCachedAccessSettings();
    const areaNames = dto.areas?.map((areaId) => areas.find((area) => area.id === areaId)?.name ?? areaId);
    const { role, canUpload, canDownload } = dto;
    recordAuditFor(auth, { action: 'access', details: { userId: id, role, canUpload, canDownload, areaNames } });
    return result;
  }
}
