import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { BillingService } from './billing.service.js';
import {
  QuotaAccountStatus,
  QuotaAccountType,
} from './schemas/quota-account.schema.js';
import {
  QuotaTransactionSource,
  QuotaTransactionType,
} from './schemas/quota-transaction.schema.js';

describe('BillingService', () => {
  let service: BillingService;

  const tenantId = new Types.ObjectId();
  const teamId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const accountId = new Types.ObjectId();

  const quotaAccountModel = {
    findOne: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
  };
  const quotaTransactionModel = {
    find: vi.fn(),
    create: vi.fn(),
  };
  const userModel = {
    find: vi.fn(),
  };
  const teamModel = {
    findOne: vi.fn(),
    find: vi.fn(),
  };

  const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
    id: String(userId),
    email: 'member@example.com',
    tenantId: String(tenantId),
    teamId: String(teamId),
    role: Role.MEMBER,
    ...overrides,
  });

  const makeAccount = (overrides: Record<string, unknown> = {}) => ({
    _id: accountId,
    tenantId,
    teamId,
    userId: null,
    type: QuotaAccountType.TEAM,
    balance: 1000,
    status: QuotaAccountStatus.ACTIVE,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: 'QuotaAccountModel', useValue: quotaAccountModel },
        { provide: 'QuotaTransactionModel', useValue: quotaTransactionModel },
        { provide: 'UserModel', useValue: userModel },
        { provide: 'TeamModel', useValue: teamModel },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  describe('recharge', () => {
    it('should deposit into team account and record a transaction', async () => {
      const account = makeAccount();
      quotaAccountModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(account),
      });
      quotaAccountModel.findOneAndUpdate.mockResolvedValue({
        ...account,
        balance: 1500,
      });
      quotaTransactionModel.create.mockResolvedValue({
        _id: new Types.ObjectId(),
        amount: 500,
        balanceAfter: 1500,
        type: QuotaTransactionType.RECHARGE,
      });

      const result = await service.recharge(makeUser({ role: Role.TEAM_ADMIN }), {
        amount: 500,
      });

      expect(result.balance).toBe(1500);
      expect(quotaTransactionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 500,
          type: QuotaTransactionType.RECHARGE,
          source: QuotaTransactionSource.RECHARGE,
        }),
      );
    });

    it('should let system recharge another team account', async () => {
      const otherTeamId = new Types.ObjectId();
      const account = makeAccount({ teamId: otherTeamId });
      teamModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: otherTeamId, tenantId }),
      });
      quotaAccountModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(account),
      });
      quotaAccountModel.findOneAndUpdate.mockResolvedValue({
        ...account,
        balance: 1500,
      });
      quotaTransactionModel.create.mockResolvedValue({
        amount: 500,
        balanceAfter: 1500,
        type: QuotaTransactionType.RECHARGE,
      });

      const result = await service.recharge(makeUser({ role: Role.SYSTEM }), {
        amount: 500,
        teamId: String(otherTeamId),
      });

      expect(result.balance).toBe(1500);
      const createArg = quotaTransactionModel.create.mock.calls[0][0];
      expect(String(createArg.teamId)).toBe(String(otherTeamId));
    });

    it('should forbid team_admin from recharging another team', async () => {
      const otherTeamId = new Types.ObjectId();

      await expect(
        service.recharge(makeUser({ role: Role.TEAM_ADMIN }), {
          amount: 500,
          teamId: String(otherTeamId),
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('adjust', () => {
    it('should clamp balance to zero on negative adjustment', async () => {
      const account = makeAccount({ balance: 100 });
      quotaAccountModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(account),
      });
      quotaAccountModel.findOneAndUpdate.mockResolvedValue({
        ...account,
        balance: 0,
      });
      quotaTransactionModel.create.mockResolvedValue({ amount: -300 });

      const result = await service.adjust(makeUser({ role: Role.TEAM_ADMIN }), {
        amount: -300,
      });

      expect(result.balance).toBe(0);
    });
  });

  describe('listAccounts', () => {
    const mockTeamFind = () => {
      teamModel.find.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      });
    };

    it('should filter to own account for a regular member', async () => {
      quotaAccountModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue([makeAccount({ userId, type: QuotaAccountType.MEMBER })]),
      });
      userModel.find.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      });
      mockTeamFind();

      await service.listAccounts(makeUser());

      const filter = quotaAccountModel.find.mock.calls[0][0];
      expect(filter.userId).toEqual(userId);
    });

    it('should list team-wide accounts for team_admin', async () => {
      quotaAccountModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue([makeAccount()]),
      });
      userModel.find.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      });
      mockTeamFind();

      await service.listAccounts(makeUser({ role: Role.TEAM_ADMIN }));

      const filter = quotaAccountModel.find.mock.calls[0][0];
      expect(filter.userId).toBeUndefined();
      expect(filter.teamId).toEqual(teamId);
    });

    it('should list accounts across all teams for system', async () => {
      quotaAccountModel.find.mockReturnValue({
        exec: vi.fn().mockResolvedValue([makeAccount()]),
      });
      userModel.find.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      });
      mockTeamFind();

      await service.listAccounts(makeUser({ role: Role.SYSTEM }));

      const filter = quotaAccountModel.find.mock.calls[0][0];
      expect(filter.userId).toBeUndefined();
      expect(filter.teamId).toBeUndefined();
    });
  });

  describe('deduct', () => {
    it('should deduct from member account when present', async () => {
      const memberAccount = makeAccount({
        userId,
        type: QuotaAccountType.MEMBER,
        balance: 500,
      });
      quotaAccountModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(memberAccount),
      });
      quotaAccountModel.findOneAndUpdate.mockResolvedValue({
        ...memberAccount,
        balance: 400,
      });
      quotaTransactionModel.create.mockResolvedValue({
        _id: new Types.ObjectId(),
        amount: -100,
        balanceAfter: 400,
        accountId,
        accountType: QuotaAccountType.MEMBER,
        userId,
        type: QuotaTransactionType.DEDUCTION,
        source: QuotaTransactionSource.USAGE,
        shortfall: false,
      });

      const result = await service.deduct({
        tenantId: String(tenantId),
        teamId: String(teamId),
        userId: String(userId),
        cost: 100,
      });

      expect(result.amount).toBe(-100);
      expect(result.accountType).toBe(QuotaAccountType.MEMBER);
    });

    it('should fall back to team account when member has no account', async () => {
      const teamAccount = makeAccount({ balance: 800 });
      quotaAccountModel.findOne
        .mockReturnValueOnce({ exec: vi.fn().mockResolvedValue(null) }) // member
        .mockReturnValueOnce({ exec: vi.fn().mockResolvedValue(teamAccount) }); // team
      quotaAccountModel.findOneAndUpdate.mockResolvedValue({
        ...teamAccount,
        balance: 700,
      });
      quotaTransactionModel.create.mockResolvedValue({
        _id: new Types.ObjectId(),
        amount: -100,
        balanceAfter: 700,
        accountId,
        accountType: QuotaAccountType.TEAM,
        userId: new Types.ObjectId(userId),
        type: QuotaTransactionType.DEDUCTION,
        source: QuotaTransactionSource.USAGE,
        shortfall: false,
      });

      const result = await service.deduct({
        tenantId: String(tenantId),
        teamId: String(teamId),
        userId: String(userId),
        cost: 100,
      });

      expect(result.accountType).toBe(QuotaAccountType.TEAM);
    });

    it('should mark shortfall when balance is insufficient', async () => {
      const memberAccount = makeAccount({
        userId,
        type: QuotaAccountType.MEMBER,
        balance: 50,
      });
      quotaAccountModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(memberAccount),
      });
      quotaAccountModel.findOneAndUpdate.mockResolvedValue({
        ...memberAccount,
        balance: 0,
      });
      quotaTransactionModel.create.mockResolvedValue({
        _id: new Types.ObjectId(),
        amount: -50,
        balanceAfter: 0,
        shortfall: true,
      });

      const result = await service.deduct({
        tenantId: String(tenantId),
        teamId: String(teamId),
        userId: String(userId),
        cost: 200,
      });

      expect(result.amount).toBe(-50);
      expect(result.shortfall).toBe(true);
    });
  });
});
