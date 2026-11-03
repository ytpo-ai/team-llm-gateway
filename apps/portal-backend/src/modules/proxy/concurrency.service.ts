import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class ConcurrencyService {
  private readonly counters = new Map<string, number>();

  acquire(keyId: string, limit: number | null): () => void {
    if (limit == null || limit <= 0) {
      return () => undefined;
    }

    const current = this.counters.get(keyId) ?? 0;
    if (current >= limit) {
      throw new HttpException(
        'API Key 并发数已达上限',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.counters.set(keyId, current + 1);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const value = this.counters.get(keyId) ?? 1;
      this.counters.set(keyId, Math.max(value - 1, 0));
    };
  }
}
