import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/user.schema';

@UseGuards(RateLimitGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.create(createPaymentDto);
  }

  @Get()
  findAll() {
    return this.paymentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    return this.paymentService.update(id, updatePaymentDto);
  }

  @Delete(':id')
  @Roles(Role.TENANT_ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.paymentService.remove(id);
  }
}
