import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { PracticeBall, launchVelocity } from '../src/ball.ts';
import { SinglesMatch, endSign } from '../src/match.ts';

test('all four score/parity service trajectories clear the net and land in the legal diagonal box',()=>{
  for(const side of ['player','cpu'] as const)for(const score of [0,1]) {
    const m=new SinglesMatch();m.start();m.server=side;m.score[side]=score;m.prepare();m.drop();m.serve(side,m.servePosition);
    const s=m.servePosition,t=m.serveTarget;
    const from=new Vector3(s.x+endSign(side)*0.32,0.26,s.z-endSign(side)*0.25);
    const dest=new Vector3(t.x,0,t.z),ball=new PracticeBall();
    ball.launch(from,launchVelocity(from,dest,Math.max(1.2,Math.hypot(dest.x-from.x,dest.z-from.z)/9.2)));
    let landed=false;
    for(let i=0;i<300;i++) {
      const event=ball.step(1/120);assert.notEqual(event,'net');assert.notEqual(event,'out');
      if(event==='bounce'){m.bounce(ball.position,ball.bounces);landed=true;break;}
    }
    assert.ok(landed);assert.equal(m.phase,'rally');assert.equal(m.serveLandingPending,false);
    assert.equal(m.bounceRequired[m.receiver],false);assert.equal(m.bounceRequired[m.server],true);
  }
});
test('a drop serve may bounce outside the baseline, then must be struck manually',()=>{
  const ball=new PracticeBall();ball.launch(new Vector3(1.8,1,7.05),new Vector3());
  let bounces=0;
  for(let i=0;i<200;i++) {
    const event=ball.step(1/120,true);
    if(event==='bounce'){bounces++;assert.ok(ball.active);assert.ok(ball.velocity.y>0);}
    if(event==='double-bounce')break;
  }
  assert.equal(bounces,1);assert.equal(ball.active,false);assert.equal(ball.bounces,2);
});
