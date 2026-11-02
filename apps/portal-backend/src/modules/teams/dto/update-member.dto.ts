import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { Role } from '../../../common/enums/role.enum.js';
import { UserStatus } from '../../users/schemas/user.schema.js';

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: '绑定角色B（LLM 使用限制模板）' })
  @IsOptional()
  @IsMongoId()
  roleTemplateId?: string;
}
