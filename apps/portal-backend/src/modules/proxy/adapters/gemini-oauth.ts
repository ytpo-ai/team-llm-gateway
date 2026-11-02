import { createSign } from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/generativelanguage';
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

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

async function exchangeToken(sa: ServiceAccount): Promise<CachedToken> {
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
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
  };
}

export async function getAccessToken(
  serviceAccountJson: string,
): Promise<string> {
  const sa = parseServiceAccount(serviceAccountJson);
  const cached = tokenCache.get(sa.client_email);
  if (cached && cached.expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
    return cached.token;
  }
  const fresh = await exchangeToken(sa);
  tokenCache.set(sa.client_email, fresh);
  return fresh.token;
}

export function clearTokenCache(): void {
  tokenCache.clear();
}
