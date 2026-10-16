import { MathUtils, Vector3 } from 'three';
import { PracticeBall, type Shot } from './ball.ts';
import { contactBodyOffset, SWING_CONTACT_DELAY } from './volley.ts';
import { inKitchen } from './match.ts';

export const PLAYER_REACH_SCALE = 1.3;
export const PLAYER_REACH = 1.05 * PLAYER_REACH_SCALE;
export const INPUT_BUFFER_SECONDS = .2;
const STEP = 1 / 240;
const MAX_QUEUE_DISTANCE = 2.6;
export interface PlayerHitContext {
  ball: PracticeBall; feet: Vector3; velocity: Vector3; speed: number;
  role: 'none' | 'serve' | 'return'; mustBounce: boolean; volleyAllowed: boolean;
  designated?: boolean;
}
export type TimingState = 'idle' | 'soon' | 'now' | 'blocked';
/** Human-only envelope. CPU canContact(), physics radius, and all rule checks stay unchanged. */
export function canPlayerContact(feet: Vector3, ball: Vector3): boolean {
  if (ball.y < .16 || ball.y > 1.95 || ball.z <= 0 || ball.z > feet.z + .25 ||
    Math.hypot(ball.x - feet.x, ball.z - feet.z) > PLAYER_REACH) return false;
  const relative = ball.clone().sub(feet), offset = contactBodyOffset(relative);
  const distance = relative.sub(offset).sub(new Vector3(.265, 1.365, 0)).length();
  return distance >= .35 / PLAYER_REACH_SCALE && distance <= .86 * PLAYER_REACH_SCALE;
}
export function canAttemptPlayerHit(c: PlayerHitContext): boolean {
  return c.role !== 'none' && c.ball.active && canPlayerContact(c.feet, c.ball.position) &&
    (c.role !== 'serve' || c.ball.bounces === 1);
}
export function legalPlayerContact(c: PlayerHitContext): boolean {
  if (!canAttemptPlayerHit(c) || c.designated === false) return false;
  return c.role === 'serve' || c.ball.bounces === 1 ||
    (!c.mustBounce && c.volleyAllowed && !inKitchen(c.feet));
}
function copyBall(source: PracticeBall): PracticeBall {
  const ball = new PracticeBall();ball.launch(source.position, source.velocity);
  ball.bounces = source.bounces;ball.netTouched = source.netTouched;ball.active = source.active;
  return ball;
}
export interface ContactPlan { time: number; point: Vector3; volley: boolean }
/** Same fixed-step gravity/bounce/net implementation, read-only forecast. No ball magnetism. */
export function forecastPlayerContact(c: PlayerHitContext, horizon: number, legalOnly = false, minimum = 0): ContactPlan | null {
  if (c.role === 'none' || !c.ball.active || c.ball.position.z > c.feet.z + .25 ||
    Math.hypot(c.ball.position.x - c.feet.x, c.ball.position.z - c.feet.z) > MAX_QUEUE_DISTANCE) return null;
  const ball = copyBall(c.ball), feet = c.feet.clone();
  for (let time = 0; time <= horizon + 1e-8; time += STEP) {
    if (time >= minimum - 1e-8 && (legalOnly ? legalPlayerContact : canAttemptPlayerHit)({...c, ball, feet})) {
      return {time, point: ball.position.clone(), volley: c.role === 'return' && ball.bounces === 0};
    }
    const event = ball.step(STEP, c.role === 'serve');
    if (!ball.active || event === 'net') break;
    // Estimate only existing movement, capped to normal court movement. Never move the actor.
    feet.x = MathUtils.clamp(c.feet.x + c.velocity.x * (time + STEP), -4.4, 4.4);
    feet.z = MathUtils.clamp(c.feet.z + c.velocity.z * (time + STEP), .55, 8.2);
  }
  return null;
}
export function playerTiming(c: PlayerHitContext): TimingState {
  if (legalPlayerContact(c)) return 'now';
  if (canAttemptPlayerHit(c)) return 'blocked';
  return forecastPlayerContact(c, INPUT_BUFFER_SECONDS * c.speed, true) ? 'soon' : 'idle';
}
export type PlayerHitEvent =
  | {kind:'start';shot:Shot;delay:number;point:Vector3;volley:boolean}
  | {kind:'impact';shot:Shot}
  | {kind:'miss'};
export interface BufferedPlayerHit {shot:Shot;age:number;remaining:number;started:boolean;committed:boolean}
/** One click = at most one contact. Buffer age uses real unpaused seconds at every speed. */
export class PlayerHitAssist {
  pending: BufferedPlayerHit | null = null;
  private clock:(()=>number)|undefined;
  private lastClock:number|null=null;
  constructor(clock?:()=>number){this.clock=clock;}
  clear() {this.pending = null;this.lastClock=null;}
  resetClock(){this.lastClock=this.clock?.()??null;}
  queue(shot: Shot, c: PlayerHitContext): boolean {
    this.clear();
    if (c.role === 'none' || !c.ball.active || c.ball.position.z > c.feet.z + .25 ||
      Math.hypot(c.ball.position.x-c.feet.x,c.ball.position.z-c.feet.z) > MAX_QUEUE_DISTANCE) return false;
    // Don't arm a swing for a ball fleeing the player with no reachable future contact.
    if (!canAttemptPlayerHit(c) && !forecastPlayerContact(c, INPUT_BUFFER_SECONDS*c.speed)) return false;
    this.pending = {shot, age:0, remaining:0, started:false, committed:canAttemptPlayerHit(c)};this.resetClock();return true;
  }
  advance(dt: number, c: PlayerHitContext): PlayerHitEvent[] {
    const p = this.pending;if (!p) return [];
    if (c.role === 'none' || !c.ball.active) {this.clear();return [];}
    const now=this.clock?.();
    p.age += now!==undefined&&this.lastClock!==null?Math.max(0,now-this.lastClock):Math.max(0,dt)/c.speed;
    if(now!==undefined)this.lastClock=now;
    if (p.age > INPUT_BUFFER_SECONDS + 1e-8 || c.ball.position.z > c.feet.z + .25) {
      // A valid click already inside reach may finish on the first slow render frame.
      // Never rescue a queued early click or a ball that has actually left the envelope.
      const committed=p.committed&&p.started&&canAttemptPlayerHit(c);
      this.clear();return committed?[{kind:'impact',shot:p.shot}]:[{kind:'miss'}];
    }
    if (!p.started) {
      const horizon = (INPUT_BUFFER_SECONDS - p.age) * c.speed;
      // Prefer a visible preparation, but rescue a fast contact that would leave before 65ms.
      const plan = forecastPlayerContact(c,horizon,false,SWING_CONTACT_DELAY/PLAYER_REACH_SCALE) ?? forecastPlayerContact(c,horizon);
      if (!plan) return [];
      p.started = true;p.remaining = plan.time;
      const events:PlayerHitEvent[] = [{kind:'start',shot:p.shot,delay:plan.time,point:plan.point,volley:plan.volley}];
      if (plan.time === 0) {this.clear();events.push({kind:'impact',shot:p.shot});}
      return events;
    }
    p.remaining -= Math.max(0,dt);
    // If motion/bounce changed, take an actual reachable contact before its window closes.
    const leavingSoon = canAttemptPlayerHit(c) && p.remaining > 0 && !forecastPlayerContact(c,p.remaining,false,p.remaining-STEP);
    if ((p.remaining <= 1e-8 || leavingSoon) && canAttemptPlayerHit(c)) {
      this.clear();return [{kind:'impact',shot:p.shot}];
    }
    return [];
  }
}
