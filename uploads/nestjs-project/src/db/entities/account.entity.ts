// src/account/entities/account.entity.ts
import {
  Entity,
  PrimaryKey,
  Property,
  OneToMany,
  Collection,
  BigIntType,
} from '@mikro-orm/core';

import { v4 } from 'uuid';
import { Transaction } from './transaction.entity';

@Entity()
export class Account {
  @PrimaryKey()
  id: string = v4();

  @Property()
  accountNumber: string;

  @Property()
  accountType: string;

  @Property({ type: BigIntType })
  balance: number = 0;

  @Property()
  customerId: string;

  @Property()
  isActive: boolean = true;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => Transaction, (transaction) => transaction.account)
  transactions = new Collection<Transaction>(this);
}
