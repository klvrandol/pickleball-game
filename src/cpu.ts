import { Vector3, MathUtils } from 'three';
import { PracticeBall, type Shot } from './ball.ts';
import { canContact, volleyStyle, type VolleyStyle, SWING_CONTACT_DELAY } from './volley.ts';
import { SwingMotion } from './swing.ts';
import { inKitchen } from './match.ts';

export interface CpuShot { shot: Shot; target: Vector3; missed: boolean; volley?: VolleyStyle }
const SPEED = 3.25;

/** Predict reachable contact with optional legal volleys, falling back to a bounce. */
export function predictContact(ball: PracticeBall, position: Vector3, allowVolley = false): Vector3 {
  const future = new PracticeBall();
  future.launch(ball.position, ball.velocity);
  future.bounces = ball.bounces; future.netTouched = ball.netTouched;
  let best = new Vector3(MathUtils.clamp(ball.position.x, -3.6, 3.6), 0, -4.5);
  for (let i = 1; i <= 360; i++) {
    const event = future.step(1 / 120);
    if (event === 'net' || !future.active) break;
    const p = future.position;
    const volley = allowVolley && future.bounces === 0 && p.z <= -2.55 && p.y >= 0.65 && p.y <= 1.85;
    if (p.z < -0.4 && (future.bounces === 1 || volley) && p.y >= 0.4 && p.y <= 1.85) {
      best = new Vector3(MathUtils.clamp(p.x, -3.8, 3.8), 0, MathUtils.clamp(p.z, -7.8, volley ? -2.6 : -0.6));
      if (Math.hypot(best.x - position.x, best.z - position.z) <= SPEED * i / 120 + 0.7) return best;
    }
  }
  return best;
}

export class CpuPlayer {
  motion = new SwingMotion();
  position = new Vector3(0, 0.045, -5);
  destination = new Vector3(0, 0, -4.5);
  reaction = 0;
  refresh = 0;
  attempted = false;
  swing = 0;
  stride = 0;
  moving = false;
  volley: VolleyStyle | undefined;
  pending: { reply: CpuShot; remaining: number } | null = null;
  status = '준비';
  private random: () => number;
  constructor(random: () => number = Math.random) { this.random = random; }

  reset() {
    this.motion.clear();
    this.position.set(0, 0.045, -5); this.destination.set(0, 0, -4.5);
    this.pending = null; this.volley = undefined; this.reaction = 0; this.attempted = false; this.swing = 0; this.status = '준비';
  }
  receive() {
    this.pending = null; this.volley = undefined;
    this.reaction = 0.22 + this.random() * 0.16;
    this.refresh = 0; this.attempted = false; this.status = '반응 중';
  }
  update(dt: number, ball: PracticeBall, player: Vector3, receiving: boolean, allowVolley = false): CpuShot | undefined {
    this.motion.advance(dt);
    this.swing = Math.max(0, this.swing - dt);
    if (this.pending) {
      this.moving = false;
      this.pending.remaining -= dt;
      if (!receiving || !ball.active) { this.pending = null; return; }
      if (this.pending.remaining > 0) return;
      const reply = this.pending.reply; this.pending = null;
      if (!canContact(this.position, ball.position) || ball.bounces !== 0 || !allowVolley || inKitchen(this.position)) {
        this.status = '헛스윙'; return { ...reply, missed: true };
      }
      if (!reply.missed) this.motion.impact(this.position, ball.position, Math.PI, true);
      return reply;
    }
    this.moving = false;
    if (receiving && ball.active && !this.attempted) {
      this.reaction = Math.max(0, this.reaction - dt);
      if (this.reaction > 0) return;
      this.refresh -= dt;
      if (this.refresh <= 0) {
        this.destination.copy(predictContact(ball, this.position, allowVolley));
        // Modest perception error is sampled at decision time, never per frame.
        this.destination.x += (this.random() - 0.5) * 0.25;
        this.refresh = 0.16;
      }
      this.status = '공 추적';
    } else {
      this.destination.set(MathUtils.clamp(player.x * 0.25, -1, 1), 0, allowVolley ? -2.8 : -4.3);
      this.status = '수비 복귀';
    }
    const dx = this.destination.x - this.position.x, dz = this.destination.z - this.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0.08) {
      const step = Math.min(distance, (receiving ? SPEED : 2.25) * dt);
      this.position.x += dx / distance * step; this.position.z += dz / distance * step;
      this.moving = true; this.stride += dt * 10;
    }
    this.position.x = MathUtils.clamp(this.position.x, -3.8, 3.8);
    this.position.z = MathUtils.clamp(this.position.z, -7.8, -0.6);
    const reach = Math.hypot(ball.position.x - this.position.x, ball.position.z - this.position.z);
    const volley = allowVolley && ball.bounces === 0 && !inKitchen(this.position);
    if (receiving && ball.active && !this.attempted && (ball.bounces === 1 || volley) && ball.position.z < -0.3 &&
      ball.position.y >= 0.45 && ball.position.y <= 1.85 && reach < 1.05 && canContact(this.position, ball.position)) {
      this.attempted = true; this.swing = 0.28;
      const difficulty = Math.max(0, reach - 0.65) + Math.max(0, ball.velocity.length() - 9) * 0.055;
      const missed = this.random() < (volley ? 0.09 : 0.025) + difficulty * 0.22;
      const forceDrive = volley && (ball.velocity.length() > 10 || ball.position.y >= 1.45);
      const shot: Shot = !forceDrive && this.position.z > -3.3 && this.random() < 0.65 ? 'dink' : 'drive';
      const attackSpace = this.random() < 0.35;
      const error = (0.12 + difficulty * 1.5);
      const x = (attackSpace ? (player.x >= 0 ? -2.1 : 2.1) : player.x * 0.4) + (this.random() - 0.5) * error;
      const z = (shot === 'dink' ? 1.5 : 4.5) + (this.random() - 0.5) * error;
      this.volley = volley ? volleyStyle(shot, ball.velocity.length(), ball.position.y) : undefined;
      this.status = missed ? '헛스윙' : volley ? (this.volley === 'soft' ? '부드러운 발리' : this.volley === 'block' ? '블록 발리' : '공격 발리') : shot === 'dink' ? '딩크' : '드라이브';
      this.motion.begin(this.position, ball.position, Math.PI, shot, volley, volley ? SWING_CONTACT_DELAY : 0);
      const reply = { shot, target: new Vector3(x, 0, z), missed, volley: this.volley };
      if (volley) { this.pending = { reply, remaining: SWING_CONTACT_DELAY }; return; }
      return reply;
    }
  }
}
