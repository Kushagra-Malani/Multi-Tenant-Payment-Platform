import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { TransferDto } from './dto/transfer.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/user.schema';

@UseGuards(RateLimitGuard)
@Controller('wallets')
export class WalletController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN)
  createWallet(@Body() dto: CreateWalletDto) {
    return this.transferService.createWallet(dto);
  }

  @Get()
  getWallets() {
    return this.transferService.getWallets();
  }

  @Get('ledger')
  getLedger() {
    return this.transferService.getLedger();
  }

  @Get('ledger/:userId')
  getLedgerForUser(@Param('userId') userId: string) {
    return this.transferService.getLedger(userId);
  }

  @Get(':userId')
  getWallet(@Param('userId') userId: string) {
    return this.transferService.getWallet(userId);
  }

  @Post('transfer')
  transfer(@Body() dto: TransferDto) {
    return this.transferService.transfer(dto);
  }
}
