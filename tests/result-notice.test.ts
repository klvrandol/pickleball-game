import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SinglesMatch, type Side } from '../src/match.ts';
import { ResultNotice, resultTitle, resultDetail } from '../src/result-notice.ts';
import { simulationDelta } from '../src/speed.ts';

function play(server: Side, loser: Side, player = 0, cpu = 0) {
  const match=new SinglesMatch();match.start();match.server=server;match.score={player,cpu};
  match.prepare();match.drop();assert.ok(match.serve(server,match.servePosition));
  match.fault(loser,'아웃!');match.tick(0.7);assert.ok(match.result);return match;
}
test('the four rally outcomes distinguish server points from receiver side-outs',()=>{
  const cases=[
    ['player','cpu','POINT! - YOU 득점',{player:1,cpu:0},'point'],
    ['cpu','player','CPU SCORES! - CPU 득점',{player:0,cpu:1},'point'],
    ['cpu','cpu','YOU SERVE!',{player:0,cpu:0},'sideout'],
    ['player','player','CPU SERVE!',{player:0,cpu:0},'sideout'],
  ] as const;
  for(const [server,loser,title,score,kind] of cases){
    const m=play(server,loser);assert.equal(resultTitle(m.result!),title);
    assert.equal(m.result!.kind,kind);assert.deepEqual(m.score,score);assert.deepEqual(m.result!.score,score);
    assert.equal(resultDetail(m.result!).includes('득점 없이'),kind==='sideout');
  }
});
test('match-winning results show only YOU WIN or YOU LOSE, including deuce',()=>{
  const won=play('player','cpu',10,9);assert.equal(resultTitle(won.result!),'YOU WIN!');
  const lost=play('cpu','player',9,10);assert.equal(resultTitle(lost.result!),'YOU LOSE!');
  const deuce=play('player','cpu',10,10);assert.equal(resultTitle(deuce.result!),'POINT! - YOU 득점');
  assert.equal(deuce.phase,'between');
});
test('provisional faults cannot announce a wrong outcome before follow-through is resolved',()=>{
  const m=new SinglesMatch();m.start();m.drop();m.serve('player',m.servePosition);m.bounce(m.serveTarget,1);
  m.hit('cpu',{x:0,z:-5},1);m.bounce({x:0,z:4},1);m.hit('player',{x:0,z:2.6},0);
  m.fault('cpu','아웃!');m.tick(0.3);assert.equal(m.result,null);
  m.updateFeet('player',{x:0,z:2},0.1,true);m.tick(0.7);
  assert.equal(resultTitle(m.result!),'CPU SERVE!');assert.deepEqual(m.score,{player:0,cpu:0});
});
test('result score snapshots survive reset and each subsequent rally gets a new result',()=>{
  const m=play('player','cpu');const result=m.result!;
  m.tick(10);assert.equal(m.result,result);assert.equal(m.score.player,1);
  m.start();assert.equal(m.result,null);assert.deepEqual(result.score,{player:1,cpu:0});
});
test('notice holds, fades smoothly and releases the next serve after two real seconds at every speed',()=>{
  for(const speed of [0.5,0.75,1] as const){
    const m=play('player','cpu');const notice=new ResultNotice();notice.show(m.result!);
    let gameTime=0;
    for(let frame=0;frame<100;frame++){notice.advance(0.01);gameTime+=simulationDelta(0.01,speed,false);}
    assert.ok(Math.abs(gameTime-speed)<1e-9);assert.equal(notice.opacity,1);
    assert.equal(notice.canPrepareServe(m.phase),false);assert.equal(m.drop(),false);
    notice.advance(0.8);assert.ok(notice.opacity>0&&notice.opacity<1);
    const fading=notice.opacity;notice.advance(0.1);assert.ok(notice.opacity<fading);assert.equal(notice.canPrepareServe(m.phase),false);
    notice.advance(0.11);assert.equal(notice.active,false);assert.equal(notice.opacity,0);assert.equal(notice.canPrepareServe(m.phase),true);
    m.prepare();assert.equal(m.drop(),true);
  }
});
test('pause freezes the notification, restart clears it, and a completed match never prepares another serve',()=>{
  const m=play('cpu','player',9,10), notice=new ResultNotice();notice.show(m.result!);notice.advance(1);
  notice.advance(20,true);assert.equal(notice.active,true);assert.equal(notice.opacity,1);
  notice.advance(1.1);assert.equal(notice.canPrepareServe(m.phase),false);
  notice.clear();assert.equal(notice.active,false);assert.equal(notice.result,null);
});
