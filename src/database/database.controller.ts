import { Controller, Post, Body, Get, Put } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { ApiTags } from '@nestjs/swagger'
import { DatabaseConnectionDto } from '@/database/database.dto'

@ApiTags('Database')
@Controller('api/database')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Post('connect')
  async connect(@Body() body: DatabaseConnectionDto) {
    return this.databaseService.connectToDatabase(body)
  }

  @Put('disconnect')
  async disconnect() {
    return this.databaseService.closeAllConnections()
  }

  @Get('data')
  async getData() {
    return this.databaseService.getData()
  }
}
