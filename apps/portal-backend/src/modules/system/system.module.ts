import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditService } from './audit.service.js';
import {
  AuditLog,
  AuditLogSchema,
} from './schemas/audit-log.schema.js';
import {
  SystemSetting,
  SystemSettingSchema,
} from './schemas/system-setting.schema.js';
import { SystemController } from './system.controller.js';
import { SystemSettingsService } from './system-settings.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SystemSetting.name, schema: SystemSettingSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [SystemController],
  providers: [SystemSettingsService, AuditService],
  exports: [SystemSettingsService, AuditService],
})
export class SystemModule {}
