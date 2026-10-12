import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from './types/auth-user.type';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() authUser: AuthUser) {
    const user = await this.usersService.findById(authUser.userId);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      teamId: user.teamId,
      role: authUser.role,
      status: user.status,
      enrollYear: user.enrollYear,
      studentId: user.studentId,
      realName: user.realName,
      avatarBase64: user.avatarBase64,
      avatarColor: user.avatarColor,
      avatarEmoji: user.avatarEmoji
    };
  }
}
