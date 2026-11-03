import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import { CurrencyController } from './currency.controller.js';
import {
  CurrencyConfig,
  CurrencyService,
} from './currency.service.js';
import { AuditService } from './audit.service.js';
import { UpdateCurrencyDto } from './dto/update-currency.dto.js';
import {
  AuditAction,
  AuditResourceType,
} from './schemas/audit-log.schema.js';

describe('CurrencyController', () => {
  let controller: CurrencyController;

  const tenantId = new Types.ObjectId().toString();
  const teamId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  const config: CurrencyConfig = {
    displayCurrency: 'CNY',
    rates: [
      { code: 'USD', name: '美元', pointsPerUnit: 10000 },
      { code: 'CNY', name: '人民币', pointsPerUnit: 1389 },
    ],
  };

  const currencyService = {
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
  };
  const auditService = {
    log: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CurrencyController],
      providers: [
        { provide: CurrencyService, useValue: currencyService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    controller = module.get(CurrencyController);
  });

  describe('getCurrency', () => {
    it('should return config for the tenant', async () => {
      currencyService.getConfig.mockResolvedValue(config);

      await expect(controller.getCurrency(tenantId)).resolves.toEqual(config);
      expect(currencyService.getConfig).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('updateCurrency', () => {
    it('should save config and write audit log', async () => {
      const dto: UpdateCurrencyDto = {
        displayCurrency: config.displayCurrency,
        rates: config.rates,
      };
      currencyService.getConfig.mockResolvedValue(null);
      currencyService.saveConfig.mockResolvedValue(config);
      auditService.log.mockResolvedValue(undefined);

      const req = { ip: '1.2.3.4', headers: { 'user-agent': 'test' } };

      await expect(
        controller.updateCurrency(
          {
            id: userId,
            email: 'a@b.c',
            tenantId,
            teamId,
            role: Role.TEAM_ADMIN,
          },
          dto,
          req as never,
        ),
      ).resolves.toEqual(config);

      expect(currencyService.saveConfig).toHaveBeenCalledWith(
        tenantId,
        userId,
        dto,
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          teamId,
          actorUserId: userId,
          action: AuditAction.CURRENCY_UPDATE,
          resourceType: AuditResourceType.CURRENCY,
          before: null,
          after: config,
        }),
      );
    });
  });
});
