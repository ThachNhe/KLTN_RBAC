import { Module } from '@nestjs/common'
import { MikroOrmModule } from '@mikro-orm/nestjs'
import { DatabaseService } from './database.service'
import { DatabaseController } from './database.controller'

@Module({
  imports: [],
  providers: [DatabaseService],
  controllers: [DatabaseController],
})
export class DatabaseModule {}
