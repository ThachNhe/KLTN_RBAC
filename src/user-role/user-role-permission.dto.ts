import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class FileUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
  })
  file: Express.Multer.File | null
}
