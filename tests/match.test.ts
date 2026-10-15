import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SinglesMatch, inKitchen, HALF_LENGTH, HALF_WIDTH, KITCHEN, LINE_HALF, type Side } from '../src/match.ts';

function serve(m = new SinglesMatch()) {
  if (m.phase === 'idle') m.start(); else m.prepare();
  m.drop(); assert.ok(m.serve(m.server, m.servePosition)); return m;
}
function rally() {
  const m=serve();m.bounce(m.serveTarget,1);
  assert.ok(m.hit('cpu',{x:0,z:-5},1));m.bounce({x:0,z:4},1);
  return m;
}
function finish(m: SinglesMatch, loser: Side) {m.fault(loser,'test fault');m.tick(0.7);}

test('only the server scores, receiver wins change service without a point',()=>{
  const m=serve();finish(m,'cpu');assert.deepEqual(m.score,{player:1,cpu:0});assert.equal(m.server,'player');
  serve(m);finish(m,'player');assert.deepEqual(m.score,{player:1,cpu:0});assert.equal(m.server,'cpu');
  serve(m);finish(m,'player');assert.deepEqual(m.score,{player:1,cpu:1});
  m.tick(10);assert.equal(m.score.cpu,1);
});
test('serve parity is relative to each server and targets the diagonal box',()=>{
  const m=new SinglesMatch();m.start();assert.equal(m.serveX,1.5);assert.equal(m.serveTarget.x,-1.5);
  m.score.player=1;assert.equal(m.serveX,-1.5);assert.equal(m.serveTarget.x,1.5);
  m.server='cpu';assert.equal(m.serveX,-1.5);assert.equal(m.serveTarget.x,1.5);
  m.score.cpu=1;assert.equal(m.serveX,1.5);assert.equal(m.serveTarget.x,-1.5);
});
test('a serve must land diagonally, beyond the kitchen including its line',()=>{
  for(const p of [{x:1,z:-4},{x:-1,z:-KITCHEN},{x:-1,z:-(KITCHEN+LINE_HALF)},{x:-1,z:-7}]) {
    const m=serve();m.bounce(p,1);assert.equal(m.pending?.loser,'player');
  }
  const m=serve();m.bounce({x:0,z:-4},1);assert.equal(m.phase,'rally');assert.equal(m.serveLandingPending,false);
});
test('outer sidelines and baseline count in; points beyond are out',()=>{
  const m=serve();m.bounce({x:-(HALF_WIDTH+LINE_HALF),z:-(HALF_LENGTH+LINE_HALF)},1);assert.equal(m.phase,'rally');
  const out=serve();out.bounce({x:-HALF_WIDTH-LINE_HALF-0.001,z:-4},1);assert.equal(out.pending?.loser,'player');
});
test('serve feet must stay behind baseline and inside the correct lateral service zone',()=>{
  for(const p of [{x:1.5,z:HALF_LENGTH+0.1},{x:-1.5,z:7.3},{x:0,z:7.3},{x:HALF_WIDTH,z:7.3}]) {
    const m=new SinglesMatch();m.start();m.drop();assert.equal(m.serve('player',p),false);assert.equal(m.pending?.loser,'player');
  }
});
test('receiver cannot volley serve, server cannot volley first return',()=>{
  const receiver=serve();assert.equal(receiver.hit('cpu',{x:0,z:-5},0),false);assert.equal(receiver.pending?.loser,'cpu');
  const server=serve();server.bounce(server.serveTarget,1);assert.ok(server.hit('cpu',{x:0,z:-5},1));
  assert.equal(server.hit('player',{x:0,z:5},0),false);assert.equal(server.pending?.loser,'player');
  const legal=rally();assert.deepEqual(legal.bounceRequired,{player:false,cpu:false});assert.ok(legal.hit('player',{x:0,z:3},0));
});
test('kitchen and boundary feet forbid volleys, bounced shots inside kitchen are legal',()=>{
  for(const p of [{x:0,z:1.5},{x:0,z:KITCHEN},{x:0,z:KITCHEN+LINE_HALF+0.19}]) {
    const m=rally();assert.equal(m.hit('player',p,0),false);assert.equal(m.pending?.loser,'player');
  }
  const bounced=rally();assert.ok(bounced.hit('player',{x:0,z:1.5},1));
  assert.equal(inKitchen({x:4,z:1}),false);
});
test('volley follow-through into kitchen overrides a provisional opponent fault before scoring',()=>{
  const m=rally();assert.ok(m.hit('player',{x:0,z:2.6},0));
  m.fault('cpu','out');m.tick(0.2);
  m.updateFeet('player',{x:0,z:2},0.1,true);m.tick(0.7);
  assert.equal(m.server,'cpu');assert.deepEqual(m.score,{player:0,cpu:0});assert.equal(m.pending?.loser,'player');
});
test('continued forward momentum remains watched, then clears on balance',()=>{
  const m=rally();m.hit('player',{x:0,z:3},0);
  m.updateFeet('player',{x:0,z:2.7},1,true);
  m.updateFeet('player',{x:0,z:2},0.01,true);assert.equal(m.pending?.loser,'player');
  const balanced=rally();balanced.hit('player',{x:0,z:3},0);
  balanced.updateFeet('player',{x:0,z:3},0.7,false);
  balanced.updateFeet('player',{x:0,z:1},0.1,true);assert.equal(balanced.phase,'rally');
});
test('second bounce faults the receiver even if the second landing is outside',()=>{
  const m=serve();m.bounce(m.serveTarget,1);m.bounce({x:9,z:-10},2);
  assert.equal(m.pending?.loser,'cpu');
});
test('net faults last hitter; a first bounce on the hitter side is a fault',()=>{
  const net=serve();net.net();assert.equal(net.pending?.loser,'player');
  const own=serve();own.bounce({x:0,z:4},1);assert.equal(own.pending?.loser,'player');
});
test('11 points require a two-point lead, including deuce and CPU wins',()=>{
  const m=serve();m.score={player:10,cpu:10};finish(m,'cpu');assert.equal(m.phase,'between');assert.equal(m.score.player,11);
  serve(m);finish(m,'cpu');assert.equal(m.phase,'over');assert.equal(m.winner,'player');assert.equal(m.score.player,12);
  const cpu=serve();cpu.score={player:9,cpu:10};cpu.server='cpu';finish(cpu,'player');assert.equal(cpu.winner,'cpu');
});
test('a complete 11-0 game can restart with all score, service and rule state reset',()=>{
  const m=new SinglesMatch();m.start();
  for(let i=0;i<11;i++){serve(m);finish(m,'cpu');}
  assert.equal(m.phase,'over');assert.deepEqual(m.score,{player:11,cpu:0});
  m.start();assert.equal(m.phase,'ready');assert.deepEqual(m.score,{player:0,cpu:0});assert.equal(m.server,'player');assert.equal(m.winner,null);
});
