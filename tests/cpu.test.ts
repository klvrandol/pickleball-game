import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { PracticeBall, shotVelocity } from '../src/ball.ts';
import { CpuPlayer, predictContact } from '../src/cpu.ts';

const dt = 1 / 120;
function incoming(target = new Vector3(0, 0, -4.5)) {
  const ball = new PracticeBall(); const from = new Vector3(0, 1, 4.8);
  ball.launch(from, shotVelocity(from, target, 'drive')); return ball;
}
test('CPU predicts a post-bounce contact without mutating the live ball', () => {
  const ball = incoming(); const before = ball.position.clone();
  const target = predictContact(ball, new Vector3(0, 0, -5));
  assert.ok(target.z < -4.5 && target.z > -7.8); assert.ok(Math.abs(target.x) < 0.1);
  assert.deepEqual(ball.position, before); assert.equal(ball.bounces, 0);
});
test('reaction is delayed and movement never exceeds walking speed', () => {
  const cpu = new CpuPlayer(() => 0.5), ball = incoming(new Vector3(2.5, 0, -4.5));
  cpu.receive(); const origin = cpu.position.clone();
  cpu.update(0.15, ball, new Vector3(), true); assert.deepEqual(cpu.position, origin);
  for(let i=0;i<100;i++) {
    const previous = cpu.position.clone(); cpu.update(dt, ball, new Vector3(), true);
    assert.ok(cpu.position.distanceTo(previous) <= 3.25 * dt + 1e-9);
  }
  assert.ok(cpu.position.x > 0.2);
});
test('reachable deep drive produces a CPU return that clears the net and lands in the player court', () => {
  const cpu = new CpuPlayer(() => 0.5), ball = incoming(); cpu.receive();
  let hit = false, landed = false;
  for (let i=0;i<700;i++) {
    const event=ball.step(dt);assert.notEqual(event,'net');assert.notEqual(event,'out');assert.notEqual(event,'double-bounce');
    if(hit && event==='bounce') { assert.ok(ball.position.z>0); landed=true; break; }
    const reply=cpu.update(dt,ball,new Vector3(0,0,5),!hit);
    if(reply) { assert.equal(reply.missed,false); hit=true; ball.launch(ball.position.clone(),shotVelocity(ball.position,reply.target,reply.shot)); }
  }
  assert.ok(hit);assert.ok(landed);
});
test('near-net CPU can dink and returns to defense after hitting', () => {
  const cpu=new CpuPlayer(()=>0.5);cpu.position.set(0,0,-1.5);cpu.receive();cpu.reaction=0;
  const ball=new PracticeBall();ball.launch(new Vector3(0,0.8,-1.5),new Vector3(0,0,-1));ball.bounces=1;
  const reply=cpu.update(dt,ball,new Vector3(2,0,5),true);
  assert.equal(reply?.shot,'dink');assert.ok(reply!.target.z<2.1336);
  const before=cpu.position.clone();cpu.update(0.1,ball,new Vector3(2,0,5),false);
  assert.ok(cpu.position.z<before.z);assert.equal(cpu.status,'수비 복귀');
});
test('a difficult ball can be missed and is not retried every frame', () => {
  const cpu=new CpuPlayer(()=>0);cpu.receive();cpu.reaction=0;
  const ball=new PracticeBall();ball.launch(new Vector3(0,0.8,-5),new Vector3(0,0,-12));ball.bounces=1;
  assert.equal(cpu.update(dt,ball,new Vector3(),true)?.missed,true);
  assert.equal(cpu.update(dt,ball,new Vector3(),true),undefined);
});
test('unreachable short ball is not magically returned', () => {
  const cpu=new CpuPlayer(()=>0.5), ball=incoming(new Vector3(2.8,0,-0.7));cpu.receive();let hits=0;
  for(let i=0;i<500&&ball.active;i++) {ball.step(dt);if(cpu.update(dt,ball,new Vector3(),true))hits++;}
  assert.equal(hits,0);
});
test('the same CPU can receive and return multiple shots in one continuous rally', () => {
  const cpu=new CpuPlayer(()=>0.5), ball=incoming();cpu.receive();
  let lastHitter='player', exchanges=0;
  for(let i=0;i<3000 && ball.active;i++) {
    const event=ball.step(dt);
    assert.notEqual(event,'net');assert.notEqual(event,'out');assert.notEqual(event,'double-bounce');
    const reply=cpu.update(dt,ball,new Vector3(0,0,5),lastHitter==='player');
    if(reply) {
      assert.equal(reply.missed,false);exchanges++;
      ball.launch(ball.position.clone(),shotVelocity(ball.position,reply.target,reply.shot));lastHitter='cpu';
      if(exchanges===3)break;
    }
    if(lastHitter==='cpu' && ball.bounces===1 && ball.position.z>0 && ball.position.y>0.45) {
      ball.launch(ball.position.clone(),shotVelocity(ball.position,new Vector3(0,0,-4.8),'dink'));
      lastHitter='player';cpu.receive();
    }
  }
  assert.equal(exchanges,3);
});
