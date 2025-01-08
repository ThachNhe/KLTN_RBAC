import { PolicyHandlerBase } from '@/policy/policy.handler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class defaultPolicy extends PolicyHandlerBase {
  constructor() {
    super('');
  }
}

@Injectable()
export class LoanEvaluationPolicy extends PolicyHandlerBase {
  constructor() {
    super('user.id === resource.loanApplication.loanOfficerId');
  }
}
