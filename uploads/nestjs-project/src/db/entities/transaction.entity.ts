import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
  Enum,
  BigIntType,
} from '@mikro-orm/core';
import { v4 } from 'uuid';
import { Account } from './account.entity';
import { TransactionType } from '@/shared/enums/transaction-type.enum';

@Entity()
export class Transaction {
  @PrimaryKey()
  id: string = v4();

  @ManyToOne(() => Account)
  account: Account;

  @Property({ type: BigIntType })
  amount: number;

  @Enum(() => TransactionType)
  type: TransactionType;

  @Property({ nullable: true })
  description?: string;

  @Property({ nullable: true })
  processedBy?: string;

  @Property({ nullable: true })
  referenceId?: string;

  @Property()
  createdAt: Date = new Date();

  // Thêm các trường mới cho việc cập nhật
  @Property({ nullable: true })
  updatedBy?: string;

  @Property({ nullable: true, onUpdate: () => new Date() })
  updatedAt?: Date;
}
