export const DEMONWARE_LOBBY_PORTS_DEFAULT = [1020, 1011] as const;

/**
 * Parse listen ports from env.
 * - `DEMONWARE_LOBBY_PORT=1020` → single port
 * - `DEMONWARE_LOBBY_PORTS=1020,1011` → list
 * - unset → {@link DEMONWARE_LOBBY_PORTS_DEFAULT}
 */
export function resolveDemonwareLobbyPorts(): number[] {
  const single = process.env.DEMONWARE_LOBBY_PORT;
  if (single?.trim()) {
    return [Number(single)];
  }

  const list = process.env.DEMONWARE_LOBBY_PORTS;
  if (list?.trim()) {
    return list
      .split(",")
      .map((p) => Number(p.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  return [...DEMONWARE_LOBBY_PORTS_DEFAULT];
}

export const DEMONWARE_BIND_HOST =
  process.env.DEMONWARE_BIND_HOST ?? process.env.HOSTNAME ?? "0.0.0.0";
