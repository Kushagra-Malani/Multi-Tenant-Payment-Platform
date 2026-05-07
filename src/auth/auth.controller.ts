import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Response, Request } from 'express';
import { Public } from '../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    // Note: The TenantMiddleware has already resolved the tenant and BaseTenantRepository 
    // will scope findByEmail to this tenant.
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    
    const tokens = await this.authService.login(user);

    // Set HTTP-only cookie for the JWT
    res.cookie('jwt', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    return {
      message: 'Logged in successfully',
      refreshToken: tokens.refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      }
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshDto: RefreshDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.refresh(refreshDto.refreshToken);

    res.cookie('jwt', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });

    return {
      message: 'Token refreshed',
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Returns the current authenticated user's latest data from MongoDB.
   * Used by the frontend to sync localStorage with the database on each page load.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@Req() req: Request) {
    const user = req['user'] as { id: string; email: string; tenantId: string; role: string };
    if (!user?.id) {
      throw new UnauthorizedException('Not authenticated');
    }

    const freshUser = await this.authService.getMe(user.id);
    return {
      id: freshUser._id,
      email: freshUser.email,
      role: freshUser.role,
      tenantId: freshUser.tenantId,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() refreshDto: RefreshDto, @Res({ passthrough: true }) res: Response) {
    if (refreshDto.refreshToken) {
      await this.authService.logout(refreshDto.refreshToken);
    }
    
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }
}
