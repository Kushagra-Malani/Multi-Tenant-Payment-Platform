import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Scope,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { TenantContextService } from '../tenant/tenant-context.service';
import { WalletRepository } from './wallet.repository';
import { LedgerRepository } from '../ledger/ledger.repository';
import { TransferDto } from './dto/transfer.dto';
import { LedgerType, LedgerStatus, LedgerDocument } from '../ledger/ledger.schema';
import { WalletDocument } from './wallet.schema';

export interface TransferResultDto {
  success: boolean;
  ledgerEntry: LedgerDocument;
  fromWallet: {
    userId: string;
    ownerName: string;
    balance: number;
    currency: string;
  };
  toWallet: {
    userId: string;
    ownerName: string;
    balance: number;
    currency: string;
  };
}

@Injectable({ scope: Scope.REQUEST })
export class TransferService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly ledgerRepository: LedgerRepository,
    private readonly tenantContext: TenantContextService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async transfer(dto: TransferDto): Promise<TransferResultDto> {
    const tenant = this.tenantContext.get();

    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    dto.currency = dto.currency.toUpperCase();

    const fromWallet = await this.walletRepository.findByUserId(dto.fromUserId);
    const toWallet = await this.walletRepository.findByUserId(dto.toUserId);

    if (!fromWallet) {
      throw new NotFoundException('Source wallet not found');
    }
    if (!toWallet) {
      throw new NotFoundException('Destination wallet not found');
    }

    if (fromWallet.currency.toUpperCase() !== toWallet.currency.toUpperCase()) {
      throw new BadRequestException('Currency mismatch: cannot transfer between different currencies');
    }

    if (fromWallet.currency.toUpperCase() !== dto.currency) {
      throw new BadRequestException('Transfer currency does not match wallet currency');
    }

    if (fromWallet.balance < dto.amount) {
      throw new BadRequestException('Insufficient funds');
    }

    const session = await this.connection.startSession();

    let ledgerEntry: LedgerDocument;

    try {
      await session.withTransaction(async () => {
        const debited = await this.walletRepository.findOneAndUpdate(
          { userId: dto.fromUserId, balance: { $gte: dto.amount } },
          { $inc: { balance: -dto.amount } },
          {},
          session,
        );

        if (!debited) {
          throw new BadRequestException('Insufficient funds (concurrent request)');
        }

        await this.walletRepository.findOneAndUpdate(
          { userId: dto.toUserId },
          { $inc: { balance: dto.amount } },
          {},
          session,
        );

        ledgerEntry = await this.ledgerRepository.create(
          {
            fromWalletId: fromWallet._id,
            toWalletId: toWallet._id,
            fromUserId: dto.fromUserId,
            toUserId: dto.toUserId,
            amount: dto.amount,
            currency: dto.currency,
            type: LedgerType.TRANSFER,
            status: LedgerStatus.COMPLETED,
            description: dto.description,
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    const updatedFrom = await this.walletRepository.findByUserId(dto.fromUserId);
    const updatedTo = await this.walletRepository.findByUserId(dto.toUserId);

    if (!updatedFrom || !updatedTo) {
      throw new Error('Wallets not found after successful transaction');
    }

    return {
      success: true,
      ledgerEntry: ledgerEntry!,
      fromWallet: {
        userId: updatedFrom.userId,
        ownerName: updatedFrom.ownerName,
        balance: updatedFrom.balance,
        currency: updatedFrom.currency,
      },
      toWallet: {
        userId: updatedTo.userId,
        ownerName: updatedTo.ownerName,
        balance: updatedTo.balance,
        currency: updatedTo.currency,
      },
    };
  }

  async getWallets(): Promise<WalletDocument[]> {
    return this.walletRepository.findAllByTenant();
  }

  async getWallet(userId: string): Promise<WalletDocument> {
    const wallet = await this.walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }

  async getLedger(userId?: string): Promise<LedgerDocument[]> {
    if (userId) {
      return this.ledgerRepository.findByUserId(userId);
    }
    return this.ledgerRepository.find({}, { sort: { createdAt: -1 } });
  }
}
