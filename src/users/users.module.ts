import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    TenantModule,
  ],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
