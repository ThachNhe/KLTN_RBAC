import { ApiProperty } from '@nestjs/swagger'
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
} from 'class-validator'

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
  @ApiProperty()
  description?: string

  @IsOptional()
  @ApiProperty()
  @IsBoolean()
  swagger?: boolean
}
