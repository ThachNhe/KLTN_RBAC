import { MemoryStorageFile } from '@blazity/nest-file-fastify'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
} from 'class-validator'
import { Transform } from 'class-transformer'

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string

  @IsEnum(['npm', 'yarn', 'pnpm'])
  @ApiProperty()
  @IsNotEmpty()
  packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @ApiProperty()
  description?: string

  @IsOptional()
  @IsNotEmpty()
  @ApiProperty()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  swagger?: boolean

  @IsOptional()
  @ApiProperty()
  @IsNotEmpty()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  auth?: boolean

  @IsOptional()
  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'upload xml file to create nestjs project',
  })
  file: MemoryStorageFile
}
