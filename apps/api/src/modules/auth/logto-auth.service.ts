import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { ERROR_CODES } from '@lecpunch/shared';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import type { AuthUser } from './types/auth-user.type';

export interface LogtoAccessTokenClaims extends JWTPayload {
  sub: string;
  organization_id?: string;
  scope?: string;
  username?: string;
  name?: string;
  custom_data?: {
    studentNumber?: string;
    realName?: string;
  };
}

@Injectable()
export class LogtoAuthService {
  private readonly endpoint: string;
  private readonly resource: string;
  private readonly organizationId: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly teamsService: TeamsService,
    private readonly configService: ConfigService
  ) {
    this.endpoint = configService.getOrThrow<string>('LOGTO_ENDPOINT').replace(/\/$/, '');
    this.resource = configService.getOrThrow<string>('LOGTO_API_RESOURCE');
    this.organizationId = configService.getOrThrow<string>('LOGTO_ORGANIZATION_ID');
    this.jwks = createRemoteJWKSet(new URL(`${this.endpoint}/oidc/jwks`));
  }

  async authenticate(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: `${this.endpoint}/oidc`,
        audience: this.resource
      });
      return this.resolveUser(payload as LogtoAccessTokenClaims);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw this.unauthorized('登录凭证无效或已过期');
    }
  }

  async resolveUser(claims: LogtoAccessTokenClaims): Promise<AuthUser> {
    const scopes = new Set(claims.scope?.split(/\s+/).filter(Boolean));
    if (claims.organization_id !== this.organizationId || !scopes.has('studio:access')) {
      throw this.unauthorized('仅 LEC Studio 成员可以访问 LecPunch');
    }

    let user = await this.usersService.findByLogtoUserId(claims.sub);
    if (!user) {
      const username = claims.username?.trim().toLowerCase();
      if (!username) throw this.unauthorized('SSO 账号缺少 Handle');
      const studentId = claims.custom_data?.studentNumber?.trim();
      if (!studentId || !/^\d{4}/.test(studentId)) throw this.unauthorized('SSO 账号缺少有效学号');
      const team = await this.teamsService.ensureDefaultTeam(
        this.configService.get<string>('DEFAULT_TEAM_NAME', 'FocusTeam')
      );
      user = await this.usersService.create({
        logtoUserId: claims.sub,
        username,
        displayName: claims.name?.trim() || claims.custom_data?.realName?.trim() || username,
        teamId: team.id,
        role: 'member',
        enrollYear: Number(studentId.slice(0, 4)),
        studentId,
        realName: claims.custom_data?.realName?.trim()
      });
    }

    if (user.status !== 'active') throw this.unauthorized('账号已停用', ERROR_CODES.USER_DISABLED);
    return {
      userId: user.id,
      teamId: user.teamId,
      role: scopes.has('studio:admin:access') ? 'admin' : 'member',
      username: user.username,
      displayName: user.displayName,
      enrollYear: user.enrollYear
    };
  }

  private unauthorized(message: string, code: string = ERROR_CODES.AUTH_UNAUTHORIZED) {
    return new UnauthorizedException({ code, message });
  }
}
