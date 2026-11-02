import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { SystemModule } from '../system/system.module.js';
import { RoleTemplateSeedService } from './role-template-seed.service.js';
import { RoleTemplatesController } from './role-templates.controller.js';
import { RoleTemplatesService } from './role-templates.service.js';
import {
  RoleTemplate,
  RoleTemplateSchema,
} from './schemas/role-template.schema.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    SystemModule,
    MongooseModule.forFeature([
      { name: RoleTemplate.name, schema: RoleTemplateSchema },
    ]),
  ],
  controllers: [RoleTemplatesController],
  providers: [RoleTemplatesService, RoleTemplateSeedService],
  exports: [RoleTemplatesService],
})
export class RoleTemplatesModule {}
