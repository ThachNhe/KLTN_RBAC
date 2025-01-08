import { Controller, Post, Body, Get } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { ApiTags } from '@nestjs/swagger'
import { DatabaseConnectionDto } from '@/database/database.dto'

@ApiTags('Database')
@Controller('api/database')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Post('connect')
  async connect(@Body() body: DatabaseConnectionDto) {
    return await this.databaseService.connectToDatabase(body)
  }

  @Get('data')
  async getData() {
    return await this.databaseService.getData()
  }
}
