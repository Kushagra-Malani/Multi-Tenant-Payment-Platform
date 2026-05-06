import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  initialBalance?: number;
}
