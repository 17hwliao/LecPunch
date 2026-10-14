import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from './types/auth-user.type';
import { UsersService } from '../users/users.service';
import { toUserResponse } from '../users/user.mapper';

@Controller('auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() authUser: AuthUser) {
    const user = await this.usersService.findById(authUser.userId);
    if (!user) return null;
    // auth/me 沿用不返回业务时间戳的契约。
    return toUserResponse(user, authUser.role, false);
  }
}
