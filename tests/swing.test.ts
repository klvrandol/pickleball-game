import './model-fixture.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { SwingMotion, swingHand, swingPose } from '../src/swing.ts';
import { createAthlete, animateAthlete } from '../src/athlete.ts';

function sample(kind: 'drive' | 'dink' | 'volley', hand = 1, time = 0.16, team: 'player' | 'cpu' = 'player') {
  const actor = createAthlete(team, 3, 0), motion = new SwingMotion();
  const target = new Vector3(hand * 0.35, 1.15, 2.45);
  motion.begin(actor.group.position, target, 0, kind === 'dink' ? 'dink' : 'drive', kind === 'volley');
  motion.advance(time);
  animateAthlete(actor, { motion, walking: false, phase: 0, swingLeft: 0, shot: 'drive', lateral: 0, side: 1, ready: false, dt: 1 / 60, time: 0, reduceMotion: false });
  actor.group.updateWorldMatrix(true, true);
  return { actor, motion, target, paddle: actor.paddle.localToWorld(new Vector3(0, -0.34, 0)) };
}
test('hand selection uses each athlete facing, including the reversed CPU', () => {
  const feet = new Vector3(0, 0, 3), right = new Vector3(1, 1, 2);
  assert.equal(swingHand(feet, right, 0), 'forehand'); assert.equal(swingHand(feet, right, Math.PI), 'backhand');
  assert.equal(swingHand(feet, new Vector3(-1, 1, 2), 0), 'backhand');
});
test('drive, dink and volley produce distinct visible paddle and torso poses on both sides', () => {
  for (const hand of [-1, 1]) {
    const drive = sample('drive', hand), dink = sample('dink', hand), volley = sample('volley', hand);
    assert.ok(drive.paddle.distanceTo(dink.paddle) > 0.08);
    assert.ok(dink.paddle.distanceTo(volley.paddle) > 0.05);
    assert.ok(Math.abs(drive.actor.chest.rotation.y) > Math.abs(dink.actor.chest.rotation.y));
    assert.ok(Math.abs(dink.actor.chest.rotation.y) > Math.abs(volley.actor.chest.rotation.y));
    assert.equal(drive.motion.hand, hand === 1 ? 'forehand' : 'backhand');
  }
});
test('all six hand/type combinations align paddle with the exact impact sample', () => {
  for (const kind of ['drive', 'dink', 'volley'] as const) for (const hand of [-1, 1]) {
    const pose = sample(kind, hand, 0.065);
    assert.ok(pose.paddle.distanceTo(pose.target) < 0.04, `${kind}/${hand}: ${pose.paddle.distanceTo(pose.target)}`);
    assert.equal(pose.actor.group.position.z, 3);
    pose.actor.group.traverse(object => assert.ok(object.matrixWorld.elements.every(Number.isFinite)));
  }
});
test('preparation reaches impact then recovers; volley is shorter than dink and drive', () => {
  const drive = sample('drive', 1, 0).motion, dink = sample('dink').motion, volley = sample('volley').motion;
  const preparation = swingPose(drive).target.clone(); drive.advance(0.065);
  assert.ok(swingPose(drive).target.distanceTo(drive.contact) < 1e-9);
  assert.ok(preparation.distanceTo(drive.contact) > 0.4);
  assert.ok(volley.finishTime < dink.finishTime && dink.finishTime < drive.finishTime);
  drive.advance(1); assert.equal(drive.active, false);
});
test('CPU has a subtle distinct finish without moving impact time or position', () => {
  assert.ok(sample('drive', 1, 0.2, 'player').paddle.distanceTo(sample('drive', 1, 0.2, 'cpu').paddle) > 0.01);
  const p = sample('drive', 1, 0.065, 'player'), c = sample('drive', 1, 0.065, 'cpu');
  assert.ok(p.paddle.distanceTo(c.paddle) < 0.00001);
});
test('the selected shot persists through later state changes and resets cleanly', () => {
  const motion = new SwingMotion(); motion.begin(new Vector3(), new Vector3(-0.4, 1, -0.5), 0, 'dink', false);
  motion.impact(new Vector3(), new Vector3(-0.4, 1, -0.5), 0, true);
  assert.equal(motion.kind, 'volley'); assert.equal(motion.shot, 'dink'); assert.equal(motion.hand, 'backhand');
  motion.clear(); assert.equal(motion.active, false);
});
