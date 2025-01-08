import {
  IsNotEmpty,
  IsUUID,
  IsBoolean,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class EvaluateLoanApplicationDto {
  @IsUUID()
  @IsNotEmpty()
  loanApplicationId: string;

  @IsBoolean()
  @IsNotEmpty()
  approved: boolean;

  @IsString()
  @IsNotEmpty()
  notes: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  interestRate?: number; // Lãi suất (chỉ cần nếu approved = true)
}
