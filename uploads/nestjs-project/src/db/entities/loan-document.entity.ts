// src/loan/entities/loan-document.entity.ts
import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { LoanApplication } from './loan-application.entity';
import { v4 } from 'uuid';

@Entity()
export class LoanDocument {
  @PrimaryKey()
  id: string = v4();

  @ManyToOne(() => LoanApplication)
  loanApplication: LoanApplication;

  @Property()
  documentType: string;

  @Property()
  filePath: string;

  @Property()
  fileName: string;

  @Property({ nullable: true })
  uploadedBy?: string;

  @Property()
  createdAt: Date = new Date();
}
