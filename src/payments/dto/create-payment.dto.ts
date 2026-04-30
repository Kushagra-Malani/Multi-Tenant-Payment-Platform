import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, Length } from 'class-validator';
import { PaymentStatus } from '../payment.schema';

export class CreatePaymentDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}
