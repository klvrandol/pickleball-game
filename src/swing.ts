import { Vector3 } from 'three';
import type { Shot } from './ball.ts';
import { SWING_CONTACT_DELAY } from './volley.ts';
export type SwingHand = 'forehand' | 'backhand';
export type SwingKind = Shot | 'volley';
export function swingHand(feet: Vector3, ball: Vector3, facing: number): SwingHand {
  return Math.cos(facing) * (ball.x - feet.x) - Math.sin(facing) * (ball.z - feet.z) >= 0 ? 'forehand' : 'backhand';
}
/** Visual clock shares the existing contact delay; it never changes ball physics. */
export class SwingMotion {
  active = false;
  age = 0;
  contactAt = SWING_CONTACT_DELAY;
  hand: SwingHand = 'forehand';
  kind: SwingKind = 'drive';
  shot: Shot = 'drive';
  contact = new Vector3();
  begin(feet: Vector3, ball: Vector3, facing: number, shot: Shot, volley: boolean, delay = SWING_CONTACT_DELAY) {
    this.active = true; this.age = 0; this.contactAt = delay; this.shot = shot;
    this.kind = volley ? 'volley' : shot; this.hand = swingHand(feet, ball, facing);
    this.capture(feet, ball, facing);
  }
  capture(feet: Vector3, ball: Vector3, facing: number) {
    this.contact.copy(ball).sub(feet).applyAxisAngle(new Vector3(0, 1, 0), -facing);
  }
  impact(feet: Vector3, ball: Vector3, facing: number, volley: boolean) {
    this.capture(feet, ball, facing); this.kind = volley ? 'volley' : this.shot;
    this.age = this.contactAt;
  }
  get finishTime() { return this.kind === 'drive' ? 0.40 : this.kind === 'dink' ? 0.34 : 0.21; }
  advance(dt: number) {
    if (!this.active) return;
    this.age += dt;
    if (this.age >= this.contactAt + this.finishTime) this.active = false;
  }
  clear() { this.active = false; }
}
export function swingPose(motion: SwingMotion, cpu = false) {
  const hand = motion.hand === 'forehand' ? 1 : -1;
  const prepare = motion.contactAt > 0 && motion.age < motion.contactAt;
  const t = prepare ? Math.max(0, motion.age / motion.contactAt) : Math.min(1, Math.max(0, (motion.age - motion.contactAt) / motion.finishTime));
  // Preparation accelerates into impact; the follow-through eases out and returns to ready.
  const amount = prepare ? (1 - t) ** 2 : Math.sin(Math.min(1, t * 1.65) * Math.PI / 2);
  const recovery = prepare ? 1 : 1 - Math.max(0, (t - 0.55) / 0.45);
  const drive = motion.kind === 'drive', dink = motion.kind === 'dink';
  const scale = cpu ? 0.93 : 1;
  const offset = new Vector3(
    hand * (prepare ? (drive ? 0.42 : dink ? 0.13 : 0.08) : -(drive ? 0.58 : dink ? 0.16 : 0.09)),
    prepare ? (drive ? -0.09 : -0.06) : drive ? 0.38 : dink ? 0.17 : 0.035,
    prepare ? (drive ? 0.32 : dink ? 0.14 : 0.08) : -(drive ? 0.35 : dink ? 0.17 : motion.shot === 'dink' ? 0.12 : 0.19),
  ).multiplyScalar(amount * scale);
  return { target: motion.contact.clone().add(offset),
    twist: hand * (prepare ? -1 : 1) * amount * (drive ? 0.30 : dink ? 0.10 : 0.055) * scale,
    recovery, support: motion.hand === 'backhand' ? 0.85 : 0.25, hand };
}
