import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class FileUploadDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'List of files (including XML and other NestJS project files)',
  })
  files: Express.Multer.File[] // Thay vì chỉ một tệp, sử dụng mảng các tệp

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'NestJS project files',
  })
  nestjsDir: Express.Multer.File[] // Cũng là mảng các tệp nếu bạn muốn tải nhiều tệp của dự án NestJS
}
