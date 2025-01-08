import {
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class TransferFundsDto {
  @IsUUID()
  @IsNotEmpty()
  sourceAccountId: string;

  @IsUUID()
  @IsNotEmpty()
  destinationAccountId: string;

  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  amount: number;

  @IsString()
  @MaxLength(255)
  description: string;
}
