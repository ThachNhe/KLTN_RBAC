import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CheckPolicies } from '@/policy/policy.decorator';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { EvaluateLoanApplicationDto } from './dto/evaluate-loan-application.dto';
import { LoanService } from './loan.service';
import { LoanEvaluationPolicy } from './policies/loan.policy';

@Controller('loans')
@UseGuards(JwtAuthGuard)
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  /**
   * Đánh giá hồ sơ vay - Chỉ Chuyên viên tín dụng (Loan Officer)
   */
  @Post('evaluate')
  @Roles('LOAN_OFFICER')
  @CheckPolicies(new LoanEvaluationPolicy())
  async evaluateLoanApplication(
    @Body() evaluateLoanDto: EvaluateLoanApplicationDto,
  ) {
    return this.loanService.evaluateLoanApplication(evaluateLoanDto);
  }
}
