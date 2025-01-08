import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';

import { EvaluateLoanApplicationDto } from './dto/evaluate-loan-application.dto';
import { LoanApplication } from '@/db/entities/loan-application.entity';
import { LoanStatus } from '@/shared/enums/loan-status.enum';

@Injectable()
export class LoanService {
  constructor(
    @InjectRepository(LoanApplication)
    private loanApplicationRepository: EntityRepository<LoanApplication>,
    private em: EntityRepository<LoanApplication>,
  ) {}

  /**
   * Đánh giá hồ sơ vay - Cho Loan Officer
   */
  async evaluateLoanApplication(evaluateLoanDto: EvaluateLoanApplicationDto) {
    const { loanApplicationId, approved, notes, interestRate } =
      evaluateLoanDto;

    const loanApplication = await this.loanApplicationRepository.findOne({
      id: loanApplicationId,
    });

    if (!loanApplication) {
      throw new NotFoundException(
        `Hồ sơ vay có ID ${loanApplicationId} không tồn tại`,
      );
    }

    // Kiểm tra trạng thái hiện tại của hồ sơ vay
    if (loanApplication.status !== LoanStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể đánh giá hồ sơ vay ở trạng thái chờ xử lý',
      );
    }

    // Cập nhật thông tin hồ sơ vay
    loanApplication.status = approved
      ? LoanStatus.APPROVED
      : LoanStatus.REJECTED;

    loanApplication.notes = notes;

    if (approved && interestRate) {
      loanApplication.interestRate = interestRate;
    }

    // Cập nhật thông tin người đánh giá
    // Giả sử loanOfficerId được lấy từ JWT token
    const loanOfficerId = 'CURRENT_OFFICER_ID'; // Thay bằng ID của chuyên viên tín dụng đang đăng nhập
    loanApplication.evaluatedBy = loanOfficerId;
    loanApplication.evaluatedAt = new Date();

    // Lưu thông tin hồ sơ vay đã cập nhật
    await this.em.flush(); // hoặc this.loanApplicationRepository.getEntityManager().flush();

    return {
      success: true,
      message: `Đã ${approved ? 'phê duyệt' : 'từ chối'} hồ sơ vay`,
      loanApplication,
    };
  }

  /**
   * Xem danh sách các khoản vay đang chờ xử lý - Cho Loan Officer
   */
  async getPendingLoans() {
    return this.loanApplicationRepository.find(
      { status: LoanStatus.PENDING },
      {
        populate: ['customer', 'documents'],
        orderBy: { createdAt: 'ASC' }, // Xử lý theo thứ tự thời gian nộp hồ sơ
      },
    );
  }
}
