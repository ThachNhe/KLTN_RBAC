import { MemoryStorageFile } from '@blazity/nest-file-fastify'
import { ApiProperty } from '@nestjs/swagger'

export class FileUploadDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'List of files (including XML and other NestJS project files)',
  })
  file: MemoryStorageFile
}
