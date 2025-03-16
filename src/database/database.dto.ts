import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class DatabaseConnectionDto {
  @ApiProperty()
  @IsString()
  ipAddress: string

  @ApiProperty()
  @IsString()
  username: string

  @ApiProperty()
  @IsString()
  password: string

  @ApiProperty()
  @IsString()
  database: string

  @ApiProperty()
  @IsString()
  port: string
}
