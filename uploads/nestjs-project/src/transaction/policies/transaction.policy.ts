import { PolicyHandlerBase } from '@/policy/policy.handler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class defaultPolicy extends PolicyHandlerBase {
  constructor() {
    super('');
  }
}

@Injectable()
export class TellerPolicy extends PolicyHandlerBase {
  constructor() {
    super('user.branch.id===resource.transaction.branchId');
  }
}

@Injectable()
export class TransferMoneyPolicy extends PolicyHandlerBase {
  constructor() {
    super('user.id===resource.sourceAccount.ownerId');
  }
}

@Injectable()
export class CustomerTransactionHistoryPolicy extends PolicyHandlerBase {
  constructor() {
    super('user.id===resource.sourceAccount.ownerId');
  }
}

@Injectable()
export class TransactionDetailsPolicy extends PolicyHandlerBase {
  constructor() {
    super('user.id === transaction.sourceAccountOwnerId');
  }
}

@Injectable()
export class DeleteTransactionPolicy extends PolicyHandlerBase {
  constructor() {
    super('user.account.id === resource.transaction.sourceAccountOwnerId');
  }
}

@Injectable()
export class UpdateTransactionPolicy extends PolicyHandlerBase {
  constructor() {
    super('user.account.id === resource.transaction.sourceAccountOwnerId');
  }
}
