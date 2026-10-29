import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const WINDOW_MS = 60_000;

@Injectable()
export class RateLimitService {
  private readonly hits = new Map<string, number[]>();

  assertAllowed(keyId: string, limitPerMinute: number | null): void {
    if (limitPerMinute == null || limitPerMinute <= 0) {
      return;
    }

    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const recent = (this.hits.get(keyId) ?? []).filter((t) => t > cutoff);

    if (recent.length >= limitPerMinute) {
      this.hits.set(keyId, recent);
      throw new HttpException(
        '请求过于频繁，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.hits.set(keyId, recent);
  }
}
