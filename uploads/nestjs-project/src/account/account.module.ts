import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import * as patientPolicies from './policies/account.policy';

@Module({
  imports: [],
  controllers: [AccountController],
  providers: [...Object.values(patientPolicies)],
})
export class PatientModule {}
