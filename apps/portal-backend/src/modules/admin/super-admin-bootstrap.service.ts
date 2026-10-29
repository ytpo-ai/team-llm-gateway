import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import { User, UserStatus } from '../users/schemas/user.schema.js';

@Injectable()
export class SuperAdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperAdminBootstrapService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.configService.get<string>('superAdmin.email');
    const password = this.configService.get<string>('superAdmin.password');

    if (!email || !password) {
      this.logger.log(
        '未配置 SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD，跳过超级管理员引导',
      );
      return;
    }

    const normalized = email.toLowerCase();
    const existing = await this.userModel
      .findOne({ email: normalized, role: Role.SYSTEM })
      .exec();
    if (existing) {
      this.logger.log('超级管理员已存在，跳过创建');
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.userModel.create({
      email: normalized,
      name: '超级管理员',
      passwordHash,
      role: Role.SYSTEM,
      status: UserStatus.ACTIVE,
    });
    this.logger.log(`超级管理员 ${normalized} 已引导创建`);
  }
}
