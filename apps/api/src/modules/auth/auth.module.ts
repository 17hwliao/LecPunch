import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { TeamsModule } from '../teams/teams.module';
import { LogtoAuthService } from './logto-auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Global()
@Module({
  imports: [UsersModule, TeamsModule],
  controllers: [AuthController],
  providers: [LogtoAuthService, JwtAuthGuard],
  exports: [LogtoAuthService, JwtAuthGuard]
})
export class AuthModule {}
