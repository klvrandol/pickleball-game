export const GAME_SPEEDS = [0.5, 0.75, 1] as const;
export type GameSpeed = typeof GAME_SPEEDS[number];
export const DEFAULT_GAME_SPEED: GameSpeed = 0.75;

export function parseGameSpeed(value: string | null): GameSpeed {
  const candidate = Number(value);
  return GAME_SPEEDS.includes(candidate as GameSpeed) ? candidate as GameSpeed : DEFAULT_GAME_SPEED;
}

/** Scale simulation time, preserving ball trajectories and AI/movement balance. */
export function simulationDelta(elapsed: number, speed: GameSpeed, stopped: boolean): number {
  if (stopped || !Number.isFinite(elapsed)) return 0;
  return Math.min(Math.max(elapsed, 0), 0.05) * speed;
}
