import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { ASSIGNABLE_ROLES } from 'src/imagepier/access-rules.js';
import { ImagePierAccessService } from 'src/imagepier/access.service.js';
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
  updateAreas(@Body() dto: AreasUpdateDto) {
    return this.service.updateAreas(dto.areas);
  }

  @Get('users/:id')
  @Authenticated({ admin: true })
  getUserAccess(@Param() { id }: UUIDParamDto) {
    return this.service.getUserAccessAdmin(id);
  }

  @Put('users/:id')
  @Authenticated({ admin: true })
  updateUserAccess(@Param() { id }: UUIDParamDto, @Body() dto: UserAccessUpdateDto) {
    return this.service.updateUserAccessAdmin(id, dto);
  }
}
