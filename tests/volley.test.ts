import './model-fixture.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { SinglesMatch } from '../src/match.ts';
import { CpuPlayer } from '../src/cpu.ts';
import { PracticeBall, FLOOR, GRAVITY } from '../src/ball.ts';
import { canContact, volleyVelocity, volleyStyle, SWING_CONTACT_DELAY } from '../src/volley.ts';
import { createAthlete, posePaddleContact } from '../src/athlete.ts';

function serve() { const m = new SinglesMatch(); m.start(); m.drop(); m.serve('player', m.servePosition); return m; }
function thirdShot() {
  const m = serve(); m.bounce(m.serveTarget, 1); assert.ok(m.hit('cpu', { x: 0, z: -5 }, 1));
  m.bounce({ x: 0, z: 4 }, 1); assert.ok(m.hit('player', { x: 0, z: 4 }, 1)); return m;
}
test('shot 2 and shot 3 require a bounce; shot 4 and subsequent volleys are legal', () => {
  const second = serve(); assert.equal(second.hits, 1);
  assert.equal(second.hit('cpu', { x: 0, z: -4 }, 0), false); assert.equal(second.pending?.loser, 'cpu');
  const third = serve(); third.bounce(third.serveTarget, 1); third.hit('cpu', { x: 0, z: -4 }, 1);
  assert.equal(third.hit('player', { x: 0, z: 4 }, 0), false); assert.equal(third.pending?.loser, 'player');
  const fourth = thirdShot(); assert.equal(fourth.hits, 3);
  assert.ok(fourth.hit('cpu', { x: 0, z: -2.8 }, 0)); assert.equal(fourth.hits, 4);
  assert.ok(fourth.hit('player', { x: 0, z: 2.8 }, 0)); assert.equal(fourth.hits, 5);
});
test('kitchen volleys fault, but the same kitchen position may play a bounced ball', () => {
  const volley = thirdShot(); assert.equal(volley.hit('cpu', { x: 0, z: -2.2 }, 0), false);
  const bounced = thirdShot(); bounced.bounce({ x: 0, z: -1 }, 1);
  assert.ok(bounced.hit('cpu', { x: 0, z: -1 }, 1)); assert.equal(bounced.phase, 'rally');
});
test('jumping out of the kitchen remains illegal until both feet are re-established outside', () => {
  const m = thirdShot(); m.updateFeet('cpu', { x: 0, z: -1.5 }, 0.01, false);
  m.updateFeet('cpu', { x: 0, z: -2.8, grounded: false }, 0.1, false);
  assert.equal(m.hit('cpu', { x: 0, z: -2.8, grounded: false }, 0), false);
  const legal = thirdShot(); legal.updateFeet('cpu', { x: 0, z: -1.5 }, 0.01, false);
  legal.updateFeet('cpu', { x: 0, z: -2.8 }, 0.1, false);
  assert.ok(legal.hit('cpu', { x: 0, z: -2.8 }, 0));
});
test('airborne follow-through stays pending until landing, including after a ball fault', () => {
  const m = thirdShot(); assert.ok(m.hit('cpu', { x: 0, z: -2.8, grounded: false }, 0));
  m.fault('player', 'out'); m.updateFeet('cpu', { x: 0, z: -1.5, grounded: false }, 2, false); m.tick(2);
  assert.equal(m.result, null);
  m.updateFeet('cpu', { x: 0, z: -1.5 }, 0.01, false); m.tick(1);
  assert.equal(m.pending?.loser, 'cpu'); assert.deepEqual(m.score, { player: 1, cpu: 0 });
});
test('volley wins and faults keep side-out scoring and service intact', () => {
  const point = thirdShot(); point.hit('cpu', { x: 0, z: -2.8 }, 0);
  point.fault('cpu', 'volley out'); point.updateFeet('cpu', { x: 0, z: -2.8 }, 1, false); point.tick(1);
  assert.equal(point.result?.kind, 'point'); assert.deepEqual(point.score, { player: 1, cpu: 0 });
  const sideout = thirdShot(); sideout.hit('cpu', { x: 0, z: -2.8 }, 0);
  sideout.fault('player', 'two bounces'); sideout.updateFeet('cpu', { x: 0, z: -2.8 }, 1, false); sideout.tick(1);
  assert.equal(sideout.result?.kind, 'sideout'); assert.equal(sideout.server, 'cpu'); assert.deepEqual(sideout.score, { player: 0, cpu: 0 });
});
test('volley contact rejects distant and unreachable high balls', () => {
  const feet = new Vector3(0, 0.045, 3);
  assert.ok(canContact(feet, new Vector3(0.4, 1.2, 2.6)));
  assert.equal(canContact(feet, new Vector3(2, 1.2, 3)), false);
  assert.equal(canContact(feet, new Vector3(0, 2.3, 3)), false);
});
test('all volley styles leave the real contact height and land on the aimed point', () => {
  const from = new Vector3(0, 1.4, -3), target = new Vector3(1, 0, 4);
  const before = from.clone();
  for (const style of ['block', 'attack', 'soft'] as const) {
    const velocity = volleyVelocity(from, target, style);
    const time = (target.z - from.z) / velocity.z;
    assert.ok(Math.abs(from.y + velocity.y * time - GRAVITY * time * time / 2 - FLOOR) < 1e-9);
    assert.ok(Math.abs(from.x + velocity.x * time - target.x) < 1e-9); assert.deepEqual(from, before);
  }
  assert.ok(volleyVelocity(from, target, 'attack').length() > volleyVelocity(from, target, 'block').length());
  assert.equal(volleyStyle('drive', 14, 1.4), 'block'); assert.equal(volleyStyle('drive', 6, 1.4), 'attack');
  assert.equal(volleyStyle('dink', 6, 1.4), 'soft');
});
test('CPU waits for swing contact, uses legal volleys, and never volleys when disabled', () => {
  for (const enabled of [false, true]) {
    const cpu = new CpuPlayer(() => 0.5); cpu.position.set(0, 0.045, -2.8); cpu.receive(); cpu.reaction = 0;
    const ball = new PracticeBall(); ball.launch(new Vector3(0, 1.35, -2.25), new Vector3(0, 0, -3));
    const initial = ball.velocity.clone(); assert.equal(cpu.update(1 / 120, ball, new Vector3(), true, enabled), undefined);
    assert.deepEqual(ball.velocity, initial); assert.equal(!!cpu.pending, enabled);
    let reply;
    for (let i = 0; i < 10; i++) { ball.step(1 / 120); reply = cpu.update(1 / 120, ball, new Vector3(), true, enabled); if (reply) break; }
    if (enabled) { assert.equal(reply?.missed, false); assert.equal(reply?.volley, 'soft'); assert.ok(cpu.position.z < -2.36); }
    else assert.equal(reply, undefined);
  }
  assert.ok(SWING_CONTACT_DELAY > 0);
});
test('CPU sometimes misses a volley rather than returning every ball', () => {
  const cpu = new CpuPlayer(() => 0); cpu.position.set(0, 0.045, -3); cpu.receive(); cpu.reaction = 0;
  const ball = new PracticeBall(); ball.launch(new Vector3(0.3, 1.3, -2.6), new Vector3(0, 0, -2));
  cpu.update(0.01, ball, new Vector3(), true, true);
  assert.equal(cpu.update(0.1, ball, new Vector3(), true, true)?.missed, true);
});
test('paddle face reaches the sampled contact without moving the gameplay root', () => {
  for (const [team, z, rotation] of [['player', 3, 0], ['cpu', -3, Math.PI]] as const) {
    const actor = createAthlete(team, z, rotation); const origin = actor.group.position.clone();
    const target = new Vector3(0.3, 1.25, z + (team === 'player' ? -0.45 : 0.45));
    posePaddleContact(actor, target); actor.group.updateWorldMatrix(true, true);
    const face = actor.paddle.localToWorld(new Vector3(0, -0.34, 0));
    assert.ok(face.distanceTo(target) < 0.04, `${team}: contact error ${face.distanceTo(target)}`);
    assert.deepEqual(actor.group.position, origin);
  }
});

test('CPU selects a block for fast approaches and an attacking volley for high slow balls', () => {
  for (const [speed, height, style] of [[12, 1.25, 'block'], [3, 1.6, 'attack']] as const) {
    const cpu = new CpuPlayer(() => 0.5); cpu.position.set(0, 0.045, -3); cpu.receive(); cpu.reaction = 0;
    const ball = new PracticeBall(); ball.launch(new Vector3(0, height, -2.45), new Vector3(0, 0, -speed));
    cpu.update(1 / 120, ball, new Vector3(), true, true);
    assert.equal(cpu.pending?.reply.volley, style);
  }
});

test('low contact crouches with planted shoes rather than sinking feet into the court', () => {
  const actor = createAthlete('player', 3, 0);
  const planted = actor.feet.map(foot => foot.getWorldPosition(new Vector3()));
  posePaddleContact(actor, new Vector3(0.3, 0.6, 2.5)); actor.group.updateWorldMatrix(true, true);
  for (let i = 0; i < actor.feet.length; i++) {
    const ankle = actor.feet[i].getWorldPosition(new Vector3());
    assert.ok(ankle.distanceTo(planted[i]) < 0.001);
    assert.ok(ankle.y >= 0.045 && ankle.y < 0.25);
  }
});
