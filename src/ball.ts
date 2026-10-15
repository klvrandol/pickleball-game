import { Vector3 } from 'three';

export const GRAVITY = 9.81;
export const BALL_RADIUS = 0.037;
export const FLOOR = 0.045 + BALL_RADIUS;
export type Shot = 'drive' | 'dink';
export type BallEvent = 'net' | 'out' | 'bounce' | 'double-bounce';

/** Solve a gravity-only trajectory whose first ground contact is the target. */
export function launchVelocity(from: Vector3, target: Vector3, seconds: number): Vector3 {
  return new Vector3((target.x - from.x) / seconds,
    (FLOOR - from.y + 0.5 * GRAVITY * seconds * seconds) / seconds,
    (target.z - from.z) / seconds);
}

export function shotVelocity(from: Vector3, target: Vector3, shot: Shot): Vector3 {
  const distance = Math.hypot(target.x - from.x, target.z - from.z);
  if (shot === 'drive') return launchVelocity(from, target, Math.max(0.44, distance / 11.5));
  const apex = Math.max(1.8, from.y + 0.65);
  const time = Math.sqrt(2 * (apex - from.y) / GRAVITY) + Math.sqrt(2 * (apex - FLOOR) / GRAVITY);
  return launchVelocity(from, target, time);
}

export class PracticeBall {
  position = new Vector3(0, 1.2, -4);
  velocity = new Vector3();
  active = false;
  bounces = 0;
  netTouched = false;

  launch(position: Vector3, velocity: Vector3) {
    this.position.copy(position); this.velocity.copy(velocity);
    this.bounces = 0; this.netTouched = false; this.active = true;
  }

  /** Called at a fixed small timestep so contacts cannot tunnel between frames. */
  step(dt: number, allowOutsideBounce = false): BallEvent | undefined {
    if (!this.active) return;
    const oldY = this.position.y, oldZ = this.position.z;
    this.position.addScaledVector(this.velocity, dt);
    this.position.y -= 0.5 * GRAVITY * dt * dt;
    this.velocity.y -= GRAVITY * dt;
    if (!this.netTouched && oldZ * this.position.z <= 0 && oldZ !== this.position.z) {
      const fraction = oldZ / (oldZ - this.position.z);
      const height = oldY + (this.position.y - oldY) * fraction;
      const x = this.position.x - this.velocity.x * dt * (1 - fraction);
      if (Math.abs(x) <= 3.4 + BALL_RADIUS && height - BALL_RADIUS <= 0.89 + 0.015 * Math.abs(x)) {
        this.position.z = Math.sign(oldZ) * (BALL_RADIUS + 0.03);
        this.velocity.z *= -0.18; this.velocity.x *= 0.5; this.velocity.y *= 0.3;
        this.netTouched = true;
        return 'net';
      }
    }
    if (this.position.y <= FLOOR && this.velocity.y < 0) {
      this.position.y = FLOOR;
      this.bounces++;
      const out = Math.abs(this.position.x) > 3.048 + 0.0254 + BALL_RADIUS || Math.abs(this.position.z) > 6.7056 + 0.0254 + BALL_RADIUS;
      if ((!allowOutsideBounce && out) || this.bounces >= 2) {
        this.active = false;
        return this.bounces >= 2 ? 'double-bounce' : 'out';
      }
      this.velocity.y *= -0.74;
      this.velocity.x *= 0.86; this.velocity.z *= 0.86;
      return 'bounce';
    }
  }
}
