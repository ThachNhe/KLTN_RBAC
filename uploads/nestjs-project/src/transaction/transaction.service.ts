import { Account } from "@/db/entities/account.entity";
import { Transaction } from "@/db/entities/transaction.entity";
import { TransactionType } from "@/shared/enums/transaction-type.enum";
import { EntityManager } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { TransferFundsDto } from "./dto/transfer-funds.dto";

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: EntityRepository<Transaction>,
    @InjectRepository(Account)
    private accountRepository: EntityRepository<Account>,
    private readonly em: EntityManager
  ) {}

  async processCashTransaction(createTransactionDto: CreateTransactionDto) {
    const { accountId, amount, type } = createTransactionDto;

    const account = await this.accountRepository.findOne({ id: accountId });

    if (!account) {
      throw new NotFoundException(`Tài khoản có ID ${accountId} không tồn tại`);
    }

    // Kiểm tra số dư nếu là giao dịch rút tiền
    if (type === TransactionType.WITHDRAWAL && account.balance < amount) {
      throw new BadRequestException("Số dư không đủ để thực hiện giao dịch");
    }

    // Cập nhật số dư tài khoản
    if (type === TransactionType.DEPOSIT) {
      account.balance += amount;
    } else if (type === TransactionType.WITHDRAWAL) {
      account.balance -= amount;
    }

    // Tạo bản ghi giao dịch mới
    const transaction = new Transaction();
    transaction.account = account;
    transaction.amount = amount;
    transaction.type = type;
    transaction.processedBy = "TELLER"; // ID của teller đang đăng nhập
    transaction.description = `${
      type === TransactionType.DEPOSIT ? "Gửi" : "Rút"
    } tiền mặt`;

    // Sử dụng transaction của Mikro-ORM
    const fork = this.em.fork();

    await fork.persistAndFlush([account, transaction]);

    return transaction;
  }

  async getTellerTransactions() {
    // Giả sử có thông tin về teller hiện tại từ request
    const tellerId = "CURRENT_TELLER_ID";

    return this.transactionRepository.find(
      { processedBy: tellerId },
      {
        populate: ["account"],
        orderBy: { createdAt: "DESC" },
      }
    );
  }

  async transferFunds(transferFundsDto: TransferFundsDto) {
    const { sourceAccountId, destinationAccountId, amount, description } =
      transferFundsDto;

    // Trong Mikro-ORM, chúng ta sử dụng transaction theo cách khác
    const fork = this.em.fork();

    try {
      // Tìm tài khoản nguồn
      const sourceAccount = await this.accountRepository.findOne({
        id: sourceAccountId,
      });

      if (!sourceAccount) {
        throw new NotFoundException(
          `Tài khoản nguồn có ID ${sourceAccountId} không tồn tại`
        );
      }

      // Tìm tài khoản đích
      const destinationAccount = await this.accountRepository.findOne({
        id: destinationAccountId,
      });

      if (!destinationAccount) {
        throw new NotFoundException(
          `Tài khoản đích có ID ${destinationAccountId} không tồn tại`
        );
      }

      // Kiểm tra số dư
      if (sourceAccount.balance < amount) {
        throw new BadRequestException("Số dư không đủ để thực hiện giao dịch");
      }

      // Cập nhật số dư tài khoản
      sourceAccount.balance -= amount;
      destinationAccount.balance += amount;

      // Tạo bản ghi giao dịch cho tài khoản nguồn
      const sourceTransaction = new Transaction();
      sourceTransaction.account = sourceAccount;
      sourceTransaction.amount = -amount;
      sourceTransaction.type = TransactionType.TRANSFER;
      sourceTransaction.description = `Chuyển tiền đến tài khoản ${destinationAccountId}: ${description}`;

      // Tạo bản ghi giao dịch cho tài khoản đích
      const destinationTransaction = new Transaction();
      destinationTransaction.account = destinationAccount;
      destinationTransaction.amount = amount;
      destinationTransaction.type = TransactionType.TRANSFER;
      destinationTransaction.description = `Nhận tiền từ tài khoản ${sourceAccountId}: ${description}`;

      // Persist entities trong transaction
      await fork.persistAndFlush([
        sourceAccount,
        destinationAccount,
        sourceTransaction,
        destinationTransaction,
      ]);

      return {
        success: true,
        message: "Chuyển tiền thành công",
        transactionId: sourceTransaction.id,
      };
    } catch (error) {
      // Rollback được xử lý tự động bởi Mikro-ORM khi có lỗi
      throw error;
    }
  }
}
