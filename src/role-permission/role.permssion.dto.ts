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
