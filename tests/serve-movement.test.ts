import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SinglesMatch, endSign, HALF_LENGTH } from '../src/match.ts';
test('both ends and score parities constrain ready/drop feet to the server-relative correct half and behind baseline',()=>{
 for(const side of ['player','cpu'] as const)for(const score of [0,1,2,7])for(const phase of ['ready','drop'] as const){
  const m=new SinglesMatch();m.start();m.server=side;m.score[side]=score;m.prepare();m.phase=phase;
  const sign=(score%2===0?1:-1)*endSign(side),bounds=m.serveMovementBounds;
  for(const x of [-100,0,100])for(const z of [-100,0,100]){
   const p={x,z,grounded:true},v={x:3,z:-3};assert.ok(m.constrainServeMovement(side,p,v));
   assert.ok(p.x*sign>.23);assert.ok(Math.abs(p.x)+.23<3.048+.0254);
   assert.ok(p.z*endSign(side)-.20>HALF_LENGTH+.0254);assert.equal(p.grounded,true);
   assert.ok(p.x>=bounds.minX&&p.x<=bounds.maxX&&p.z>=bounds.minZ&&p.z<=bounds.maxZ);
   if(p.x!==x)assert.equal(v.x,0);if(p.z!==z)assert.equal(v.z,0);
  }
 }
});
test('manual movement, inertia and arbitrary assist displacements share the same post-movement restriction',()=>{
 const m=new SinglesMatch();m.start();m.score.player=1;m.prepare();
 const p={...m.servePosition},v={x:3.8,z:-3.8};
 for(let i=0;i<240;i++){
  p.x+=v.x/60+.08;p.z+=v.z/60-.08;
  m.constrainServeMovement('player',p,v);
  assert.ok(p.x<-.23);assert.ok(p.z>6.93);
 }
 assert.equal(v.x,0);assert.equal(v.z,0);
});
test('receiver is unrestricted during preparation and all server restrictions release immediately on a legal serve',()=>{
 for(const side of ['player','cpu'] as const)for(const score of [0,1]){
  const m=new SinglesMatch();m.start();m.server=side;m.score[side]=score;m.prepare();
  const receiver=side==='player'?'cpu':'player',p={x:-m.serveX,z:2*endSign(receiver)},copy={...p};
  assert.equal(m.constrainServeMovement(receiver,p),false);assert.deepEqual(p,copy);
  const feet={x:0,z:0};m.constrainServeMovement(side,feet);m.drop();assert.equal(m.serve(side,feet),true);
  const free={x:-Math.sign(m.serveX),z:endSign(side)*3},v={x:3,z:2};const before={...free};
  assert.equal(m.constrainServeMovement(side,free,v),false);assert.deepEqual(free,before);assert.deepEqual(v,{x:3,z:2});
 }
});
test('score changes and side-outs prepare a legal new start in each service half, without changing scoring',()=>{
 for(const side of ['player','cpu'] as const){
  const m=new SinglesMatch();m.start();m.server=side;m.prepare();
  const initial={...m.servePosition};m.drop();m.serve(side,initial);
  m.fault(side==='player'?'cpu':'player','test');m.tick(1);assert.equal(m.score[side],1);m.prepare();
  assert.equal(Math.sign(m.servePosition.x),-Math.sign(initial.x));assert.equal(m.constrainServeMovement(side,m.servePosition),false);
  m.drop();assert.ok(m.serve(side,m.servePosition));m.fault(side,'test');m.tick(1);
  assert.notEqual(m.server,side);assert.equal(m.score[m.server],0);m.prepare();
  assert.equal(m.servePosition.x,endSign(m.server)*1.5);assert.equal(m.constrainServeMovement(m.server,m.servePosition),false);
 }
});
