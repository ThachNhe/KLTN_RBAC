import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { Account } from '@/db/entities';

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account)
    private accountRepository: EntityRepository<Account>,
  ) {}

  async editAccount(id: string, updateAccountDto: any) {
    const account = await this.accountRepository.findOne({ id });

    if (!account) {
      throw new NotFoundException(`Tài khoản có ID ${id} không tồn tại`);
    }

    // Kiểm tra quyền truy cập (người dùng chỉ có thể sửa tài khoản thuộc sở hữu)
    // Giả sử customerId được lấy từ JWT token
    const customerId = 'CURRENT_CUSTOMER_ID'; // Thay bằng ID của khách hàng đang đăng nhập

    if (account.customerId !== customerId) {
      throw new BadRequestException(
        'Bạn không có quyền sửa thông tin tài khoản này',
      );
    }

    // Cập nhật thông tin tài khoản
    Object.assign(account, updateAccountDto);
    await this.accountRepository.persistAndFlush(account);

    return account;
  }

  async getAccountDetails(accountId: string) {
    const account = await this.accountRepository.findOne(
      { id: accountId },
      { populate: ['transactions'] },
    );

    if (!account) {
      throw new NotFoundException(`Tài khoản có ID ${accountId} không tồn tại`);
    }

    // Kiểm tra quyền truy cập (người dùng chỉ có thể xem tài khoản thuộc sở hữu)
    // Giả sử customerId được lấy từ JWT token
    const customerId = 'CURRENT_CUSTOMER_ID'; // Thay bằng ID của khách hàng đang đăng nhập

    if (account.customerId !== customerId) {
      throw new BadRequestException(
        'Bạn không có quyền xem thông tin tài khoản này',
      );
    }

    return account;
  }
}
