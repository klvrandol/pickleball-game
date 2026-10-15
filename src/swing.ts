import { Vector3 } from 'three';
import type { Shot } from './ball.ts';
import { sampleSwingKey, swingProfile } from './swing-keyframes.ts';
import { SWING_CONTACT_DELAY } from './volley.ts';
export type SwingHand = 'forehand' | 'backhand';
export type SwingKind = Shot | 'volley';
export function swingHand(feet: Vector3, ball: Vector3, facing: number): SwingHand {
  return Math.cos(facing) * (ball.x - feet.x) - Math.sin(facing) * (ball.z - feet.z) >= 0 ? 'forehand' : 'backhand';
}
/** Visual clock shares the existing contact delay; it never changes ball physics. */
export class SwingMotion {
  serial = 0;
  aimYaw = 0;
  active = false;
  age = 0;
  contactAt = SWING_CONTACT_DELAY;
  hand: SwingHand = 'forehand';
  kind: SwingKind = 'drive';
  shot: Shot = 'drive';
  contact = new Vector3();
  begin(feet: Vector3, ball: Vector3, facing: number, shot: Shot, volley: boolean, delay = SWING_CONTACT_DELAY) {
    this.serial++; this.aimYaw = 0;
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
  aimAt(feet: Vector3, target: Vector3, facing: number) {
    const local = target.clone().sub(feet).applyAxisAngle(new Vector3(0, 1, 0), -facing);
    this.aimYaw = Math.max(-0.35, Math.min(0.35, Math.atan2(-local.x, -local.z)));
  }
  get finishTime() { return this.kind === 'drive' ? 0.58 : this.kind === 'dink' ? 0.46 : 0.30; }
  get clipTime() {
    return this.age < this.contactAt && this.contactAt > 0 ? this.age / this.contactAt * 0.5 :
      0.5 + Math.min(1, Math.max(0, (this.age - this.contactAt) / this.finishTime)) * 0.5;
  }
  advance(dt: number) {
    if (!this.active) return;
    this.age += dt;
    if (this.age >= this.contactAt + this.finishTime) this.active = false;
  }
  clear() { this.active = false; }
}
export function swingPose(motion: SwingMotion, cpu = false) {
  const key = sampleSwingKey(swingProfile(motion.hand, motion.kind), motion.clipTime);
  const canonical = new Vector3(motion.hand === 'forehand' ? .35 : -.35, 1.15, -.55);
  const offset = new Vector3(...key.paddle).sub(canonical).multiplyScalar(cpu ? .93 : 1);
  return { target: motion.contact.clone().add(offset), twist: key.chain[1],
    recovery: motion.clipTime > .82 ? (1 - motion.clipTime) / .18 : 1,
    support: key.support, hand: motion.hand === 'forehand' ? 1 : -1 };
}
