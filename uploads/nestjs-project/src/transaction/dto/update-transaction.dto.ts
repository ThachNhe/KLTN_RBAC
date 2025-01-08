import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TransactionType } from '@/shared/enums/transaction-type.enum';

export class UpdateTransactionDto {
  @IsOptional()
  @IsNumber()
  @Min(1000, { message: 'Số tiền giao dịch phải lớn hơn 1,000 VND' })
  amount?: number;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsString()
  description?: string;
}
