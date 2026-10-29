import { HttpException } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service.js';

describe('RateLimitService', () => {
  it('should not throw when limit is null', () => {
    const service = new RateLimitService();
    expect(() => service.assertAllowed('k1', null)).not.toThrow();
  });

  it('should allow requests under the limit', () => {
    const service = new RateLimitService();
    expect(() => service.assertAllowed('k1', 2)).not.toThrow();
    expect(() => service.assertAllowed('k1', 2)).not.toThrow();
  });

  it('should throw when rate limit exceeded', () => {
    const service = new RateLimitService();
    service.assertAllowed('k1', 2);
    service.assertAllowed('k1', 2);
    expect(() => service.assertAllowed('k1', 2)).toThrow(HttpException);
  });
});
