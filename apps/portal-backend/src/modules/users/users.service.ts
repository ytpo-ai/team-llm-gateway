import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import { User, UserDocument } from './schemas/user.schema.js';

export interface CreateUserInput {
  tenantId: Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
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

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  create(input: CreateUserInput): Promise<UserDocument> {
    return this.userModel.create(input);
  }
}
