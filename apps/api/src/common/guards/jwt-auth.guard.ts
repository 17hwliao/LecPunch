import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ERROR_CODES } from '@lecpunch/shared';
import { LogtoAuthService } from '../../modules/auth/logto-auth.service';
import type { AuthUser } from '../../modules/auth/types/auth-user.type';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: LogtoAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    const match = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
    if (!match?.[1]) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_UNAUTHORIZED,
        message: '缺少登录凭证'
      });
    }
    (request as Request & { user: AuthUser }).user = await this.auth.authenticate(match[1]);
    return true;
  }
}
