import { genId } from '@/shared/util';
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'bigint' })
  @ApiProperty()
  id: string = genId();

  @Property()
  @ApiProperty()
  public email: string;

  @Property({ nullable: true })
  @ApiProperty()
  public phoneNumber?: string;

  @Property()
  @ApiProperty()
  public username: string;

  @Exclude()
  @Property({ hidden: true })
  @Property()
  @ApiProperty()
  public password: string;

  @Property({ nullable: true })
  @ApiProperty()
  public firstName: string;

  @Property({ nullable: true })
  @ApiProperty()
  public lastName: string;

  @Property({ type: 'timestamp' })
  @ApiProperty()
  createdAt: Date = new Date();

  @Property({ type: 'timestamp', onUpdate: () => new Date() })
  @ApiProperty()
  updatedAt: Date = new Date();
}
