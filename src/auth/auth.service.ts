import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { Redis } from 'ioredis';
import { LoginDto } from './dto/login.dto';
import { UserDocument } from '../users/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  async validateUser(email: string, pass: string): Promise<UserDocument> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials or inactive user');
    }
    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials or inactive user');
    }
    return user;
  }

  async login(user: UserDocument) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      tier: 'starter', // In a real app this would be fetched from tenant config
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign({ sub: user._id.toString(), tenantId: user.tenantId }, { expiresIn: '7d' });

    // Store refresh token in Redis
    const redisKey = `refreshtoken:${user.tenantId}:${user._id.toString()}:${refreshToken}`;
    await this.redisClient.set(redisKey, 'valid', 'EX', 7 * 24 * 60 * 60);

    return {
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      const userId = decoded.sub;
      const tenantId = decoded.tenantId;

      const redisKey = `refreshtoken:${tenantId}:${userId}:${refreshToken}`;
      const isValid = await this.redisClient.get(redisKey);

      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.usersService.findById(userId);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User no longer valid');
      }

      return this.login(user);
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      const redisKey = `refreshtoken:${decoded.tenantId}:${decoded.sub}:${refreshToken}`;
      await this.redisClient.del(redisKey);
    } catch (e) {
      // If token is invalid or already expired, we don't care during logout
    }
  }

  /**
   * Fetch the latest user document from MongoDB.
   * Called by GET /auth/me to keep the frontend in sync.
   */
  async getMe(userId: string): Promise<UserDocument> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return user;
  }
}
