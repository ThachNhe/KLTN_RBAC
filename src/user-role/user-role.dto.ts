import { MemoryStorageFile } from '@blazity/nest-file-fastify'
import { ApiProperty } from '@nestjs/swagger'

export class FileUploadDto {
  @ApiProperty({
    type: 'file',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'CSV file to upload',
  })
  file: MemoryStorageFile
}
