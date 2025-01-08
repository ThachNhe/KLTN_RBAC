import { PoliciesGuard } from '@/policy/policies.guard';
import { CheckPolicies } from '@/policy/policy.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AccountService } from './acount.service';
import { UpdateAccountPolicy, GetAccPolicy } from './policies/account.policy';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

@Controller('accounts')
@UseGuards(JwtAuthGuard, RolesGuard, PoliciesGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  // Lấy chi tiết tài khoản
  @Get(':id')
  @Roles('CUSTOMER')
  @UseGuards(RolesGuard)
  @CheckPolicies(new GetAccPolicy())
  async getAccount(@Param('id') id: string) {
    return this.accountService.getAccountDetails(id);
  }

  // Cập nhật thông tin tài khoản
  @Put()
  @Roles('CUSTOMER')
  @CheckPolicies(new UpdateAccountPolicy())
  async updateAccount(@Param('id') id: string, @Body() updateAccountDto: any) {
    return this.accountService.editAccount(id, updateAccountDto);
  }
}
