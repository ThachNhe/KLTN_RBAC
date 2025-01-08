// src/loan/entities/loan-application.entity.ts
import { LoanStatus } from '@/shared/enums/loan-status.enum';
import {
  Entity,
  PrimaryKey,
  Property,
  OneToMany,
  Collection,
  Enum,
  BigIntType,
} from '@mikro-orm/core';
import { v4 } from 'uuid';
import { LoanDocument } from './loan-document.entity';

@Entity()
export class LoanApplication {
  @PrimaryKey()
  id: string = v4();

  @Property()
  customerId: string;

  @Property({ type: BigIntType })
  amount: number;

  @Property()
  term: number; // Kỳ hạn (tháng)

  @Property({ nullable: true })
  purpose?: string;

  @Enum(() => LoanStatus)
  status: LoanStatus = LoanStatus.PENDING;

  @Property({ nullable: true })
  interestRate?: number;

  @Property({ nullable: true })
  notes?: string;

  @Property({ nullable: true })
  evaluatedBy?: string;

  @Property({ nullable: true })
  evaluatedAt?: Date;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @OneToMany(() => LoanDocument, (document) => document.loanApplication)
  documents = new Collection<LoanDocument>(this);
}
