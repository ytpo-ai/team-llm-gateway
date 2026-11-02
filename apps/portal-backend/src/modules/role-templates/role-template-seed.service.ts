import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { RoleTemplatesService } from './role-templates.service.js';

@Injectable()
export class RoleTemplateSeedService implements OnApplicationBootstrap {
  constructor(private readonly roleTemplatesService: RoleTemplatesService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.roleTemplatesService.ensureBuiltInTemplates();
  }
}
