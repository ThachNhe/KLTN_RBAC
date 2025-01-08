import { User } from '@/db/entities';
import dbConfig from '@/mikro-orm.config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  imports: [
    MikroOrmModule.forRoot(dbConfig),
    MikroOrmModule.forFeature({
      entities: [User],
    }),
  ],
  exports: [MikroOrmModule],
})
export class OrmModule {}
