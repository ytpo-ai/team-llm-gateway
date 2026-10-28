import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { Invitation, InvitationSchema } from './schemas/invitation.schema.js';
import { Team, TeamSchema } from './schemas/team.schema.js';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    UsersModule,
    MongooseModule.forFeature([
      { name: Team.name, schema: TeamSchema },
      { name: Invitation.name, schema: InvitationSchema },
    ]),
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
