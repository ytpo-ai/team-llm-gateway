import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

function ipv4ToNumber(ip: string): number {
  const octets = ip.split('.');
  if (octets.length !== 4) return 0;
  return (
    ((Number(octets[0]) << 24) |
      (Number(octets[1]) << 16) |
      (Number(octets[2]) << 8) |
      Number(octets[3])) >>>
    0
  );
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToNumber(ip);
  const ranges: Array<[number, number]> = [
    [0x00000000, 0x00ffffff], // 0.0.0.0/8
    [0x0a000000, 0x0affffff], // 10.0.0.0/8
    [0x64400000, 0x647fffff], // 100.64.0.0/10 (CGNAT)
    [0x7f000000, 0x7fffffff], // 127.0.0.0/8 (loopback)
    [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 (link-local, 含云元数据)
    [0xac100000, 0xac1fffff], // 172.16.0.0/12
    [0xc0000000, 0xc00000ff], // 192.0.0.0/24
    [0xc0000200, 0xc00002ff], // 192.0.2.0/24 (TEST-NET)
    [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
    [0xc6120000, 0xc613ffff], // 198.18.0.0/15 (benchmark)
    [0xc6336400, 0xc63364ff], // 198.51.100.0/24 (TEST-NET-2)
    [0xcb007100, 0xcb0071ff], // 203.0.113.0/24 (TEST-NET-3)
    [0xe0000000, 0xefffffff], // 224.0.0.0/4 (multicast)
    [0xf0000000, 0xffffffff], // 240.0.0.0/4 (reserved)
  ];
  return ranges.some(([start, end]) => n >= start && n <= end);
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10
  if (lower.startsWith('ff')) return true; // ff00::/8
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true;
}

export async function isPublicHostname(hostname: string): Promise<boolean> {
  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return false;
    return addresses.every(({ address }) => !isPrivateIp(address));
  } catch {
    return false;
  }
}

export async function isSafeImageUrl(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }
  return isPublicHostname(parsed.hostname);
}
