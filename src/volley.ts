import { Vector3 } from 'three';
import { launchVelocity, GRAVITY, FLOOR, type Shot } from './ball.ts';

export type VolleyStyle = 'block' | 'attack' | 'soft';
export const SWING_CONTACT_DELAY = 0.065;
/** Contact envelope follows the shoulder and paddle's combined reach, not a remote hit radius. */
export function canContact(feet: Vector3, ball: Vector3): boolean {
  const horizontal = Math.hypot(ball.x - feet.x, ball.z - feet.z);
  if (ball.y < 0.16 || ball.y > 1.95 || horizontal > 1.05) return false;
  const facing = feet.z >= 0 ? 1 : -1;
  const relative = new Vector3((ball.x - feet.x) * facing, ball.y - feet.y, (ball.z - feet.z) * facing);
  const offset = contactBodyOffset(relative);
  const shoulderDistance = relative.sub(offset).sub(new Vector3(0.265, 1.365, 0)).length();
  return shoulderDistance >= 0.35 && shoulderDistance <= 0.86;
}
/** Shared visual reach: a small torso lunge and crouch; feet stay at their physical position. */
export function contactBodyOffset(relative: Vector3): Vector3 {
  const offset = new Vector3(relative.x - 0.265, 0, relative.z);
  const lunge = Math.min(0.30, Math.max(0, offset.length() - 0.55));
  offset.normalize().multiplyScalar(lunge);
  offset.y = -Math.min(0.42, Math.max(0, 1.0 - relative.y) * 0.7);
  return offset;
}
export function volleyStyle(shot: Shot, incomingSpeed: number, height: number): VolleyStyle {
  return shot === 'dink' ? 'soft' : incomingSpeed > 10 || height < 1.05 ? 'block' : 'attack';
}
/** Starts at the untouched contact position. Solves the same gravity trajectory as ground strokes. */
export function volleyVelocity(from: Vector3, target: Vector3, style: VolleyStyle): Vector3 {
  const distance = Math.hypot(target.x - from.x, target.z - from.z);
  if (style === 'soft') {
    const apex = Math.max(1.35, from.y + 0.32);
    const time = Math.sqrt(2 * (apex - from.y) / GRAVITY) + Math.sqrt(2 * (apex - FLOOR) / GRAVITY);
    return launchVelocity(from, target, time);
  }
  return launchVelocity(from, target, Math.max(0.36, distance / (style === 'block' ? 8.2 : 13)));
}
