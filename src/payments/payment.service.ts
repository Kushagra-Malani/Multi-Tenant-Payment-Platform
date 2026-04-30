import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentRepository } from './payment.repository';
import { UsageTrackingService } from '../usage/usage-tracking.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { TenantContextService } from '../tenant/tenant-context.service';
import { PaymentDocument } from './payment.schema';

@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly usageTracking: UsageTrackingService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<PaymentDocument> {
    const tenant = this.tenantContext.get();

    const hasExceeded = await this.usageTracking.hasExceededTransactionLimit(tenant);
    if (hasExceeded) {
      throw new ForbiddenException('Monthly transaction limit exceeded for this tenant tier.');
    }

    const payment = await this.paymentRepository.create(createPaymentDto);

    await this.usageTracking.trackTransaction(tenant.id).catch(() => {});

    return payment;
  }

  async findAll(): Promise<PaymentDocument[]> {
    return this.paymentRepository.find();
  }

  async findOne(id: string): Promise<PaymentDocument> {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found.`);
    }
    return payment;
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto): Promise<PaymentDocument> {
    const payment = await this.paymentRepository.findByIdAndUpdate(id, updatePaymentDto);
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found.`);
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
