import { createSign } from 'node:crypto';
import { getTokenCache } from './token-cache.js';

const SCOPE = 'https://www.googleapis.com/auth/generativelanguage';

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

export function parseServiceAccount(json: string): ServiceAccount {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const client_email = asString(parsed.client_email);
  const private_key = asString(parsed.private_key);
  const token_uri = asString(parsed.token_uri, 'https://oauth2.googleapis.com/token');
  if (!client_email || !private_key) {
    throw new Error('服务账号 JSON 缺少 client_email 或 private_key');
  }
  return { client_email, private_key, token_uri };
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function signJwt(sa: ServiceAccount): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };
  const encode = (obj: unknown): string =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(sa.private_key, 'base64url');
  return `${signingInput}.${signature}`;
}

async function exchangeToken(
  sa: ServiceAccount,
): Promise<{ token: string; ttlMs: number }> {
  const assertion = signJwt(sa);
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`换取 access_token 失败（HTTP ${res.status}）`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error('换取 access_token 失败：响应缺少 access_token');
  }
  const expiresIn = Number(data.expires_in ?? 3600);
  return {
    token: data.access_token,
    ttlMs: (expiresIn - 60) * 1000,
  };
}

export async function getAccessToken(
  serviceAccountJson: string,
): Promise<string> {
  const sa = parseServiceAccount(serviceAccountJson);
  const cache = getTokenCache();

  try {
    const cached = await cache.get(sa.client_email);
    if (cached) return cached;
  } catch {
    // 缓存不可用（如 Redis 宕机）时降级为直接换取 token
  }

  const fresh = await exchangeToken(sa);
  try {
    await cache.set(sa.client_email, fresh.token, fresh.ttlMs);
  } catch {
    // 缓存写入失败不影响返回
  }
  return fresh.token;
}
