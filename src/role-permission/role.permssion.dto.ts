import { MemoryStorageFile } from '@blazity/nest-file-fastify'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ZipEntryData } from 'archiver'
import { IsString } from 'class-validator'

export class permissionCheckDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
  })
  @IsString()
  xmlFile: Express.Multer.File | null

  @ApiPropertyOptional()
  nestjsProject: ZipEntryData
}

export class RolePermissionFileUploadDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'upload xml file',
  })
  file: MemoryStorageFile

  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'NestJS project files',
  })
  projectFile: MemoryStorageFile
}
