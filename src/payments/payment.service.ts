import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentRepository } from './payment.repository';
import { UsageTrackingService } from '../usage/usage-tracking.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { TenantContextService } from '../tenant/tenant-context.service';
import { PaymentDocument, PaymentStatus } from './payment.schema';
import { TransferService } from '../wallets/transfer.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly usageTracking: UsageTrackingService,
    private readonly tenantContext: TenantContextService,
    private readonly transferService: TransferService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<PaymentDocument> {
    const tenant = this.tenantContext.get();

    const hasExceeded = await this.usageTracking.hasExceededTransactionLimit(tenant);
    if (hasExceeded) {
      throw new ForbiddenException('Monthly transaction limit exceeded for this tenant tier.');
    }

    const payment = await this.paymentRepository.create(createPaymentDto);

    await this.usageTracking.trackTransaction(tenant.id).catch(() => {});

    if (payment.status === PaymentStatus.COMPLETED) {
      await this.transferService.deposit(
        payment.walletId,
        payment.amount,
        payment.currency,
        `Payment ${payment._id}`,
      );
    }

    return payment;
  }

  async findAll(): Promise<PaymentDocument[]> {
    return this.paymentRepository.find({}, { sort: { createdAt: -1 } });
  }

  async findOne(id: string): Promise<PaymentDocument> {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found.`);
    }
    return payment;
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto): Promise<PaymentDocument> {
    const existing = await this.findOne(id);
    const payment = await this.paymentRepository.findByIdAndUpdate(id, updatePaymentDto);
    
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found.`);
    }

    // If status changed to COMPLETED, deposit to wallet
    if (existing.status !== PaymentStatus.COMPLETED && updatePaymentDto.status === PaymentStatus.COMPLETED) {
      await this.transferService.deposit(
        payment.walletId,
        payment.amount,
        payment.currency,
        `Payment ${payment._id}`,
      );
    }

    return payment;
  }

  async remove(id: string): Promise<PaymentDocument> {
    const payment = await this.paymentRepository.softDelete(id);
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found.`);
    }
    return payment;
  }
}
