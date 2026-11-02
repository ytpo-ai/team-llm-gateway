import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/schemas/user.schema.js';
import { AdjustQuotaDto } from './dto/adjust-quota.dto.js';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto.js';
import { RechargeQuotaDto } from './dto/recharge-quota.dto.js';
import {
  QuotaAccount,
  QuotaAccountDocument,
  QuotaAccountStatus,
  QuotaAccountType,
} from './schemas/quota-account.schema.js';
import {
  QuotaTransaction,
  QuotaTransactionSource,
  QuotaTransactionType,
} from './schemas/quota-transaction.schema.js';

export interface QuotaAccountView {
  id: string;
  type: QuotaAccountType;
  userId: string | null;
  label: string | null;
  balance: number;
  status: QuotaAccountStatus;
  createdAt?: Date;
}

export interface QuotaTransactionView {
  id: string;
  accountId: string;
  accountType: QuotaAccountType;
  userId: string | null;
  type: QuotaTransactionType;
  source: QuotaTransactionSource;
  amount: number;
  balanceAfter: number;
  shortfall: boolean;
  referenceId: string | null;
  description: string | null;
  createdAt?: Date;
}

export interface DeductInput {
  tenantId: string;
  teamId: string;
  userId: string;
  cost: number;
  referenceId?: string;
  description?: string;
}

const TRANSACTION_LIMIT = 100;

@Injectable()
export class BillingService {
  constructor(
    @InjectModel(QuotaAccount.name)
    private readonly quotaAccountModel: Model<QuotaAccount>,
    @InjectModel(QuotaTransaction.name)
    private readonly quotaTransactionModel: Model<QuotaTransaction>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async recharge(user: AuthUser, dto: RechargeQuotaDto): Promise<QuotaAccountView> {
    const account = await this.resolveTargetAccount(
      user.tenantId,
      user.teamId,
      dto.userId,
    );
    const updated = await this.applyDelta(account, dto.amount);
    await this.quotaTransactionModel.create({
      tenantId: new Types.ObjectId(user.tenantId),
      teamId: new Types.ObjectId(user.teamId),
      userId: account.userId,
      accountId: account._id,
      accountType: account.type,
      type: QuotaTransactionType.RECHARGE,
      source: QuotaTransactionSource.RECHARGE,
      amount: dto.amount,
      balanceAfter: updated.balance,
      shortfall: false,
      referenceId: null,
      description: dto.description ?? null,
    });
    return this.toAccountView(updated, null);
  }

  async adjust(user: AuthUser, dto: AdjustQuotaDto): Promise<QuotaAccountView> {
    const account = await this.resolveTargetAccount(
      user.tenantId,
      user.teamId,
      dto.userId,
    );
    const updated = await this.applyDelta(account, dto.amount);
    await this.quotaTransactionModel.create({
      tenantId: new Types.ObjectId(user.tenantId),
      teamId: new Types.ObjectId(user.teamId),
      userId: account.userId,
      accountId: account._id,
      accountType: account.type,
      type: QuotaTransactionType.ADJUSTMENT,
      source: QuotaTransactionSource.MANUAL,
      amount: dto.amount,
      balanceAfter: updated.balance,
      shortfall: dto.amount < 0 && updated.balance === 0 && account.balance < Math.abs(dto.amount),
      referenceId: null,
      description: dto.description ?? null,
    });
    return this.toAccountView(updated, null);
  }

  async listAccounts(user: AuthUser): Promise<QuotaAccountView[]> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(user.tenantId),
      teamId: new Types.ObjectId(user.teamId),
      status: QuotaAccountStatus.ACTIVE,
    };
    if (user.role === Role.MEMBER) {
      filter.userId = new Types.ObjectId(user.id);
    }

    const accounts = await this.quotaAccountModel.find(filter).exec();
    const memberIds = accounts
      .filter((a) => a.type === QuotaAccountType.MEMBER && a.userId)
      .map((a) => String(a.userId));
    const labelMap = await this.buildLabelMap(memberIds);

    return accounts.map((a) =>
      this.toAccountView(a, a.userId ? labelMap.get(String(a.userId)) ?? null : null),
    );
  }

  async listTransactions(
    user: AuthUser,
    query: ListTransactionsQueryDto,
  ): Promise<QuotaTransactionView[]> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(user.tenantId),
    };
    if (user.role === Role.MEMBER) {
      filter.userId = new Types.ObjectId(user.id);
    } else {
      filter.teamId = new Types.ObjectId(user.teamId);
    }
    if (query.type) filter.type = query.type;
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    const rows = await this.quotaTransactionModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(TRANSACTION_LIMIT)
      .exec();

    return rows.map((row) => ({
      id: String(row._id),
      accountId: String(row.accountId),
      accountType: row.accountType,
      userId: row.userId ? String(row.userId) : null,
      type: row.type,
      source: row.source,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      shortfall: row.shortfall,
      referenceId: row.referenceId,
      description: row.description,
      createdAt: row.createdAt,
    }));
  }

  async getSpendableBalance(
    tenantId: string,
    teamId: string,
    userId: string,
  ): Promise<number> {
    const account = await this.resolveSpendableAccount(tenantId, teamId, userId);
    return account.balance;
  }

  async deduct(input: DeductInput): Promise<QuotaTransactionView> {
    const account = await this.resolveSpendableAccount(
      input.tenantId,
      input.teamId,
      input.userId,
    );

    const cost = Math.max(input.cost, 0);
    const deducted = Math.min(account.balance, cost);
    const balanceAfter = Math.max(account.balance - cost, 0);

    await this.quotaAccountModel.findOneAndUpdate(
      { _id: account._id },
      [
        {
          $set: {
            balance: {
              $max: [{ $subtract: ['$balance', deducted] }, 0],
            },
          },
        },
      ],
      { new: true },
    );

    const doc = await this.quotaTransactionModel.create({
      tenantId: new Types.ObjectId(input.tenantId),
      teamId: new Types.ObjectId(input.teamId),
      userId: new Types.ObjectId(input.userId),
      accountId: account._id,
      accountType: account.type,
      type: QuotaTransactionType.DEDUCTION,
      source: QuotaTransactionSource.USAGE,
      amount: -deducted,
      balanceAfter,
      shortfall: deducted < cost,
      referenceId: input.referenceId ?? null,
      description: input.description ?? null,
    });

    return {
      id: String(doc._id),
      accountId: String(doc.accountId),
      accountType: doc.accountType,
      userId: doc.userId ? String(doc.userId) : null,
      type: doc.type,
      source: doc.source,
      amount: doc.amount,
      balanceAfter: doc.balanceAfter,
      shortfall: doc.shortfall,
      referenceId: doc.referenceId,
      description: doc.description,
      createdAt: doc.createdAt,
    };
  }

  private async resolveTargetAccount(
    tenantId: string,
    teamId: string,
    userId?: string,
  ): Promise<QuotaAccountDocument> {
    return userId
      ? this.getOrCreateMemberAccount(tenantId, teamId, userId)
      : this.getOrCreateTeamAccount(tenantId, teamId);
  }

  private async resolveSpendableAccount(
    tenantId: string,
    teamId: string,
    userId: string,
  ): Promise<QuotaAccountDocument> {
    const member = await this.quotaAccountModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
        type: QuotaAccountType.MEMBER,
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (member) return member;
    return this.getOrCreateTeamAccount(tenantId, teamId);
  }

  private async getOrCreateTeamAccount(
    tenantId: string,
    teamId: string,
  ): Promise<QuotaAccountDocument> {
    const existing = await this.quotaAccountModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
        type: QuotaAccountType.TEAM,
        userId: null,
      })
      .exec();
    if (existing) return existing;
    return this.quotaAccountModel.create({
      tenantId: new Types.ObjectId(tenantId),
      teamId: new Types.ObjectId(teamId),
      userId: null,
      type: QuotaAccountType.TEAM,
      balance: 0,
      status: QuotaAccountStatus.ACTIVE,
    });
  }

  private async getOrCreateMemberAccount(
    tenantId: string,
    teamId: string,
    userId: string,
  ): Promise<QuotaAccountDocument> {
    const existing = await this.quotaAccountModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        teamId: new Types.ObjectId(teamId),
        type: QuotaAccountType.MEMBER,
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (existing) return existing;
    return this.quotaAccountModel.create({
      tenantId: new Types.ObjectId(tenantId),
      teamId: new Types.ObjectId(teamId),
      userId: new Types.ObjectId(userId),
      type: QuotaAccountType.MEMBER,
      balance: 0,
      status: QuotaAccountStatus.ACTIVE,
    });
  }

  private async applyDelta(
    account: QuotaAccountDocument,
    delta: number,
  ): Promise<QuotaAccountDocument> {
    const updated = await this.quotaAccountModel.findOneAndUpdate(
      { _id: account._id },
      [
        {
          $set: {
            balance: {
              $max: [{ $add: ['$balance', delta] }, 0],
            },
          },
        },
      ],
      { new: true },
    );
    if (!updated) {
      throw new Error('额度账户更新失败');
    }
    return updated;
  }

  private async buildLabelMap(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const users = await this.userModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select('name email')
      .exec();
    return new Map(
      users.map((u) => [String(u._id), u.name || u.email || '']),
    );
  }

  private toAccountView(
    account: QuotaAccountDocument,
    label: string | null,
  ): QuotaAccountView {
    return {
      id: String(account._id),
      type: account.type,
      userId: account.userId ? String(account.userId) : null,
      label,
      balance: account.balance,
      status: account.status,
      createdAt: account.createdAt,
    };
  }
}
