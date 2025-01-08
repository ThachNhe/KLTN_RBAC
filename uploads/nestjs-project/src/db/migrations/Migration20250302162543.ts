import { Migration } from '@mikro-orm/migrations';

export class Migration20250302162543 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "users" ("id" bigserial primary key, "email" varchar(255) not null, "phone_number" varchar(255) null, "password" varchar(255) not null, "first_name" varchar(255) null, "last_name" varchar(255) null, "created_at" timestamptz not null, "updated_at" timestamptz not null);`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "users" cascade;`);
  }

}
