import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import { Role } from '../../../common/enums/role.enum.js';

export class CreateInvitationDto {
  @ApiProperty({ example: 'member@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: Role, example: Role.MEMBER })
  @IsEnum(Role)
  role: Role;
}
