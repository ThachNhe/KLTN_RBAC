import { PolicyHandlerBase } from '@/policy/policy.handler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class defaultPolicy extends PolicyHandlerBase {
  constructor() {
    super('');
  }
}

@Injectable()
export class UpdateAccountPolicy extends PolicyHandlerBase {
  constructor() {
    super('user.account.id === resource.account.id');
  }
}

@Injectable()
export class GetAccPolicy extends PolicyHandlerBase {
  constructor() {
    super('user.id === resource.account.ownerId');
  }
}
