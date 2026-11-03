import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, Min } from 'class-validator';
import {
  PolicyAction,
  PolicyMeasure,
  PolicyWindow,
} from '../schemas/policy-set.schema.js';

export class PolicyEntryDto {
  @ApiProperty({ enum: PolicyMeasure, example: PolicyMeasure.TOKEN })
  @IsEnum(PolicyMeasure)
  measure: PolicyMeasure;

  @ApiProperty({ enum: PolicyWindow, example: PolicyWindow.DAY })
  @IsEnum(PolicyWindow)
  window: PolicyWindow;

  @ApiProperty({ description: '限值（0 或空 = 不限）', example: 30000000 })
  @IsNumber()
  @Min(0)
  limit: number;

  @ApiProperty({ enum: PolicyAction, example: PolicyAction.BLOCK })
  @IsEnum(PolicyAction)
  action: PolicyAction;
}
