/**
 * Destiny PreAlpha XHTTP sign-on failover ports (hosts.json / title DNS).
 * Override with SIGNON_HTTP_PORTS=32000,32001,...
 */
export const SIGNON_HTTP_PORTS_DEFAULT = [
  32000, 32001, 32004, 32005, 32008, 32009,
] as const;

export function resolveSignonHttpPorts(): number[] {
  const raw = process.env.SIGNON_HTTP_PORTS?.trim();
  if (!raw) {
    return [...SIGNON_HTTP_PORTS_DEFAULT];
  }
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}
