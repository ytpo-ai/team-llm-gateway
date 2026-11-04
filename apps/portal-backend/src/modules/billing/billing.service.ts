import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { Team } from '../teams/schemas/team.schema.js';
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
  teamId: string;
  teamName: string | null;
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
    @InjectModel(Team.name) private readonly teamModel: Model<Team>,
  ) {}

  async recharge(user: AuthUser, dto: RechargeQuotaDto): Promise<QuotaAccountView> {
    const teamId = await this.resolveTargetTeamId(user, dto.teamId);
    const account = await this.resolveTargetAccount(
      user.tenantId,
      teamId,
      dto.userId,
    );
    const updated = await this.applyDelta(account, dto.amount);
    await this.quotaTransactionModel.create({
      tenantId: new Types.ObjectId(user.tenantId),
      teamId: new Types.ObjectId(teamId),
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
    return this.toAccountView(updated, null, null);
  }

  async adjust(user: AuthUser, dto: AdjustQuotaDto): Promise<QuotaAccountView> {
    const teamId = await this.resolveTargetTeamId(user, dto.teamId);
    const account = await this.resolveTargetAccount(
      user.tenantId,
      teamId,
      dto.userId,
    );
    const updated = await this.applyDelta(account, dto.amount);
    await this.quotaTransactionModel.create({
      tenantId: new Types.ObjectId(user.tenantId),
      teamId: new Types.ObjectId(teamId),
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
    return this.toAccountView(updated, null, null);
  }

  async listAccounts(user: AuthUser): Promise<QuotaAccountView[]> {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(user.tenantId),
      status: QuotaAccountStatus.ACTIVE,
    };
    if (user.role === Role.MEMBER) {
      filter.userId = new Types.ObjectId(user.id);
    } else if (user.role === Role.TEAM_ADMIN) {
      filter.teamId = new Types.ObjectId(user.teamId);
    }

    const accounts = await this.quotaAccountModel.find(filter).exec();
    const memberIds = accounts
      .filter((a) => a.type === QuotaAccountType.MEMBER && a.userId)
      .map((a) => String(a.userId));
    const teamIds = [...new Set(accounts.map((a) => String(a.teamId)))];
    const [labelMap, teamNameMap] = await Promise.all([
      this.buildLabelMap(memberIds),
      this.buildTeamNameMap(teamIds),
    ]);

    return accounts.map((a) =>
      this.toAccountView(
        a,
        a.userId ? (labelMap.get(String(a.userId)) ?? null) : null,
        teamNameMap.get(String(a.teamId)) ?? null,
      ),
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
      { new: true, updatePipeline: true },
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

  private async resolveTargetTeamId(
    user: AuthUser,
    requestedTeamId?: string,
  ): Promise<string> {
    if (!requestedTeamId || requestedTeamId === user.teamId) {
      return user.teamId;
    }
    if (user.role !== Role.SYSTEM) {
      throw new ForbiddenException('无权操作其他团队的额度');
    }
    const team = await this.teamModel
      .findOne({ _id: requestedTeamId, tenantId: user.tenantId })
      .exec();
    if (!team) {
      throw new NotFoundException('团队不存在');
    }
    return requestedTeamId;
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
      { new: true, updatePipeline: true },
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

  private async buildTeamNameMap(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const teams = await this.teamModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select('name')
      .exec();
    return new Map(teams.map((t) => [String(t._id), t.name]));
  }

  private toAccountView(
    account: QuotaAccountDocument,
    label: string | null,
    teamName: string | null,
  ): QuotaAccountView {
    return {
      id: String(account._id),
      type: account.type,
      teamId: String(account.teamId),
      teamName,
      userId: account.userId ? String(account.userId) : null,
      label,
      balance: account.balance,
      status: account.status,
      createdAt: account.createdAt,
    };
  }
}
