import { TransactionType } from '@/shared/enums/transaction-type.enum';
import {
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsUUID,
  Min,
  IsString,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  amount: number;

  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
