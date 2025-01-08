import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import * as doctorPolicies from './policies/transaction.policy';

@Module({
  imports: [],
  controllers: [TransactionController],
  providers: [...Object.values(doctorPolicies)],
})
export class DoctorModule {}
