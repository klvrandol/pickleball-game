import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { PracticeBall, shotVelocity } from '../src/ball.ts';
import { CpuPlayer } from '../src/cpu.ts';
import { parseGameSpeed, simulationDelta, type GameSpeed } from '../src/speed.ts';

test('first launch and invalid stored preferences use 0.75; supported choices restore exactly',()=>{
  for(const value of [null,'','0','2','NaN','Infinity','fast'])assert.equal(parseGameSpeed(value),0.75);
  for(const speed of [0.5,0.75,1] as const)assert.equal(parseGameSpeed(String(speed)),speed);
});
test('pause freezes simulation at every speed, and 1x retains the previous timestep limit',()=>{
  for(const speed of [0.5,0.75,1] as const)assert.equal(simulationDelta(1/60,speed,true),0);
  assert.equal(simulationDelta(1/60,1,false),1/60);
  assert.equal(simulationDelta(10,1,false),0.05);
  assert.equal(simulationDelta(10,0.5,false),0.025);
  assert.equal(simulationDelta(-1,0.75,false),0);
  assert.equal(simulationDelta(NaN,0.75,false),0);
});
test('slower settings extend wall-clock reaction time without changing ball path or CPU return position',()=>{
  function run(speed: GameSpeed) {
    const ball=new PracticeBall(), cpu=new CpuPlayer(()=>0.5);
    const from=new Vector3(0,1,4.8);
    ball.launch(from,shotVelocity(from,new Vector3(0,0,-4.5),'drive'));cpu.receive();
    let accumulator=0;
    const events: string[]=[];
    for(let frame=1;frame<1500;frame++) {
      accumulator+=simulationDelta(1/120,speed,false);
      while(accumulator+1e-12>=1/120) {
        const event=ball.step(1/120);if(event)events.push(event);
        const reply=cpu.update(1/120,ball,new Vector3(0,0,5),true);
        if(reply){assert.equal(reply.missed,false);return {wallTime:frame/120,ball:ball.position.clone(),cpu:cpu.position.clone(),events};}
        accumulator-=1/120;
      }
    }
    throw Error('CPU did not return a reachable ball');
  }
  const baseline=run(1);
  for(const speed of [0.5,0.75] as const) {
    const slower=run(speed);
    assert.ok(Math.abs(slower.wallTime-baseline.wallTime/speed)<=1/120+1e-9);
    assert.ok(slower.ball.distanceTo(baseline.ball)<1e-9);
    assert.ok(slower.cpu.distanceTo(baseline.cpu)<1e-9);
    assert.deepEqual(slower.events,baseline.events);
  }
});
