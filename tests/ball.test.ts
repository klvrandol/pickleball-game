import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { PracticeBall, FLOOR, launchVelocity, shotVelocity } from '../src/ball.ts';

test('drive and dink reach the aimed ground position, with a higher dink arc', () => {
  const from = new Vector3(0, 1.2, 2.8), target = new Vector3(1, 0, -4);
  const peaks: number[] = [];
  for (const shot of ['drive', 'dink'] as const) {
    const ball = new PracticeBall(); ball.launch(from, shotVelocity(from, target, shot));
    let peak = 0, landed = false;
    for (let i = 0; i < 1000; i++) {
      const event = ball.step(1 / 1000); peak = Math.max(peak, ball.position.y);
      if (event === 'bounce') {
        assert.ok(Math.abs(ball.position.x - target.x) < 0.02);
        assert.ok(Math.abs(ball.position.z - target.z) < 0.02);
        landed = true; break;
      }
      assert.notEqual(event, 'net');
    }
    assert.ok(landed); peaks.push(peak);
  }
  assert.ok(peaks[1] > peaks[0]);
});
test('ground bounces lose energy and second bounce ends the ball', () => {
  const ball = new PracticeBall();ball.launch(new Vector3(0, 1, 3), new Vector3());
  const events = [];
  for(let i=0;i<500;i++) { const event=ball.step(1/120);if(event) events.push(event); }
  assert.deepEqual(events,['bounce','double-bounce']);assert.equal(ball.active,false);assert.equal(ball.position.y,FLOOR);
});
test('net crossing and an out-of-court first landing are faults', () => {
  const net = new PracticeBall();net.launch(new Vector3(0,0.4,0.1),new Vector3(0,0,-15));
  assert.equal(net.step(1/60),'net');assert.ok(net.velocity.z>0);
  const out = new PracticeBall();out.launch(new Vector3(4,1,3),new Vector3());
  let result; for(let i=0;i<120;i++) result=out.step(1/120)??result;
  assert.equal(result,'out');assert.equal(out.active,false);
});
test('practice feed crosses net and lands inside player court',()=>{
  const ball=new PracticeBall();const from=new Vector3(0,1.25,-4.5);
  ball.launch(from,launchVelocity(from,new Vector3(0,0,4),1.35));
  let bounced=false;
  for(let i=0;i<200;i++){const event=ball.step(1/120);assert.notEqual(event,'net');if(event==='bounce'){bounced=true;assert.ok(Math.abs(ball.position.z-4)<0.06);break;}}
  assert.ok(bounced);
});
