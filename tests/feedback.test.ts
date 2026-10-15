import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { PracticeBall } from '../src/ball.ts';
import { landingPoint, contactQuality } from '../src/feedback.ts';
import { SinglesMatch, inCourt } from '../src/match.ts';

test('landing guide matches actual first bounce on descending and rising balls',()=>{
  for(const vertical of [-3,4]) {
    const ball=new PracticeBall();ball.launch(new Vector3(0.2,1.8,3),new Vector3(1.1,vertical,1.4));
    const expected=landingPoint(ball.position,ball.velocity);
    let landed=false;
    for(let i=0;i<300;i++) {
      const event=ball.step(1/120);
      if(event==='bounce'||event==='out') {
        assert.ok(Math.hypot(ball.position.x-expected.x,ball.position.z-expected.z)<0.025);
        landed=true;break;
      }
    }
    assert.ok(landed);
  }
});
test('outgoing projected landing remains visibly out rather than clamping into court',()=>{
  const expected=landingPoint(new Vector3(2.9,1,4),new Vector3(5,1,1));
  assert.equal(inCourt(expected),false);assert.ok(expected.x>3.1);
});
test('contact advice distinguishes a good contact from low, high and reaching shots',()=>{
  assert.equal(contactQuality(0.6,0.9),'sweet');
  assert.equal(contactQuality(0.6,0.25),'low');
  assert.equal(contactQuality(0.6,1.8),'high');
  assert.equal(contactQuality(1.2,0.9),'stretch');
});
test('pre-serve aiming warning agrees with actual service landing faults at both parities',()=>{
  for(const score of [0,1]) {
    const m=new SinglesMatch();m.start();m.score.player=score;
    assert.equal(m.serveLandingError(m.serveTarget),undefined);
    for(const target of [{x:0,z:-1},{x:-m.serveTarget.x,z:-4},{x:4,z:-4}]) {
      const warning=m.serveLandingError(target);assert.ok(warning);
      m.prepare();m.drop();m.serve('player',m.servePosition);m.bounce(target,1);
      assert.equal(m.phase,'settling');assert.equal(m.pending?.loser,'player');
    }
  }
});
