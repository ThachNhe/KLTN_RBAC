import { Module } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { DatabaseController } from './database.controller'

@Module({
  imports: [],
  providers: [DatabaseService],
  controllers: [DatabaseController],
  exports: [DatabaseService],
})
export class DatabaseModule {}
