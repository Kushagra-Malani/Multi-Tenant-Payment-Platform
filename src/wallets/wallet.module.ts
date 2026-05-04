import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantModule } from '../tenant/tenant.module';
import { UsageModule } from '../usage/usage.module';
import { Wallet, WalletSchema } from './wallet.schema';
import { Ledger, LedgerSchema } from '../ledger/ledger.schema';
import { WalletRepository } from './wallet.repository';
import { LedgerRepository } from '../ledger/ledger.repository';
import { TransferService } from './transfer.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: Ledger.name, schema: LedgerSchema },
    ]),
    TenantModule,
    UsageModule,
  ],
  controllers: [WalletController],
  providers: [WalletRepository, LedgerRepository, TransferService],
  exports: [TransferService],
})
export class WalletModule {}
