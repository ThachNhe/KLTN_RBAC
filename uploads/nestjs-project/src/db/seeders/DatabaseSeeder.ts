import { UserSeeder } from './user.seed';
import { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';

export class DatabaseSeeder extends Seeder {
  run(em: EntityManager) {
    return this.call(em, [UserSeeder]);
  }
}
