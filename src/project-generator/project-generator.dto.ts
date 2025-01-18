import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsEnum, IsOptional } from 'class-validator'

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  name: string

  @IsEnum(['npm', 'yarn', 'pnpm'])
  @ApiProperty()
  packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'

  @IsString()
  @IsOptional()
  @ApiProperty()
  description?: string
}
