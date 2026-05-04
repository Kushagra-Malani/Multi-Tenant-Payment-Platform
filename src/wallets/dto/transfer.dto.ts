import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class TransferDto {
  @IsString()
  @IsNotEmpty()
  fromUserId!: string;

  @IsString()
  @IsNotEmpty()
  toUserId!: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  currency: string = 'INR';

  @IsString()
  @IsOptional()
  description?: string;
}
