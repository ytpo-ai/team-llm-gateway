import { isPrivateIp, isSafeImageUrl } from './ssrf-guard.js';

describe('isPrivateIp', () => {
  it('blocks loopback and private IPv4', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('0.0.0.0')).toBe(true);
  });

  it('blocks reserved and multicast IPv4', () => {
    expect(isPrivateIp('224.0.0.1')).toBe(true);
    expect(isPrivateIp('240.0.0.1')).toBe(true);
    expect(isPrivateIp('100.64.0.1')).toBe(true);
  });

  it('allows public IPv4', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });

  it('blocks private IPv6', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('::')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('fd12::1')).toBe(true);
  });

  it('allows public IPv6', () => {
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
  });

  it('treats unrecognized input as private', () => {
    expect(isPrivateIp('not-an-ip')).toBe(true);
  });
});

describe('isSafeImageUrl', () => {
  it('rejects non-http(s) schemes', async () => {
    await expect(isSafeImageUrl('file:///etc/passwd')).resolves.toBe(false);
    await expect(isSafeImageUrl('ftp://example.com/a.png')).resolves.toBe(false);
  });

  it('rejects private-host URLs (literal IP)', async () => {
    await expect(isSafeImageUrl('http://169.254.169.254/latest/meta-data')).resolves.toBe(false);
    await expect(isSafeImageUrl('http://127.0.0.1/secret')).resolves.toBe(false);
    await expect(isSafeImageUrl('http://10.0.0.5/a.png')).resolves.toBe(false);
  });

  it('rejects invalid URL', async () => {
    await expect(isSafeImageUrl('not a url')).resolves.toBe(false);
  });
});
