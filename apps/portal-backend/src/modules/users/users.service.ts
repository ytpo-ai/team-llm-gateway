import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import { User, UserDocument, UserStatus } from './schemas/user.schema.js';

export interface CreateUserInput {
  tenantId: Types.ObjectId;
  teamId?: Types.ObjectId;
  email?: string | null;
  name: string;
  passwordHash?: string | null;
  role: Role;
  roleTemplateId?: Types.ObjectId | null;
}

export interface UpdateUserInput {
  role?: Role;
  status?: UserStatus;
  teamId?: Types.ObjectId;
  roleTemplateId?: Types.ObjectId | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  findByEmail(
    tenantId: Types.ObjectId,
    email: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ tenantId, email: email.toLowerCase() })
      .exec();
  }

  findSystemUserByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase(), role: Role.SYSTEM })
      .exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByIds(ids: string[]): Promise<UserDocument[]> {
    return this.userModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .exec();
  }

  listByTeam(tenantId: string, teamId: string): Promise<UserDocument[]> {
    return this.userModel.find({ tenantId, teamId }).sort({ createdAt: 1 }).exec();
  }

  create(input: CreateUserInput): Promise<UserDocument> {
    return this.userModel.create(input);
  }

  updateById(
    id: string,
    patch: UpdateUserInput,
  ): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, patch, { new: true }).exec();
  }
}
