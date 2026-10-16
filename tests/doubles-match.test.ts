import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DoublesMatch,TEAM,MEMBERS,doublesTitle,type ActorId} from '../src/doubles-match.ts';
import {endSign} from '../src/match.ts';
function begin(m:DoublesMatch){m.prepare();m.drop();assert.ok(m.serveActor(m.serverId,m.servePosition));}
function lose(m:DoublesMatch,team:'player'|'cpu'){m.fault(team,'test');m.tick(1);assert.ok(m.doublesResult);}
test('opening exception is 0-0-2; first loss goes directly to opponents 0-0-1',()=>{
 const m=new DoublesMatch();m.start();assert.equal(m.scoreCall,'0-0-2');assert.equal(m.serverId,'ranger');assert.equal(m.designatedReceiver,'barbarian');begin(m);lose(m,'player');assert.equal(m.serverId,'barbarian');assert.equal(m.serverNumber,1);assert.equal(m.doublesResult?.kind,'sideout');assert.deepEqual(m.score,{player:0,cpu:0});
});
test('first server loses: same team partner becomes second server; next loss is sideout',()=>{
 const m=new DoublesMatch();m.start();begin(m);lose(m,'player');begin(m);lose(m,'cpu');assert.equal(m.server,'cpu');assert.equal(m.serverId,'mage');assert.equal(m.serverNumber,2);assert.equal(m.scoreCall,'0-0-2');assert.equal(m.doublesResult?.kind,'second-server');begin(m);lose(m,'cpu');assert.equal(m.serverId,'ranger');assert.equal(m.serverNumber,1);assert.equal(m.server,'player');
});
test('points swap serving team court positions only; same player keeps serving; receivers update diagonally',()=>{
 const m=new DoublesMatch();m.start();for(let i=1;i<6;i++){const right=m.right.cpu;begin(m);lose(m,'cpu');assert.equal(m.score.player,i);assert.equal(m.serverId,'ranger');assert.equal(m.right.cpu,right);assert.equal(Math.sign(m.serveX),i%2===0?1:-1);assert.equal(m.designatedReceiver,i%2===0?'barbarian':'mage');assert.match(doublesTitle(m.doublesResult!),/우리 팀 득점/);}
});
test('sideout starts with current right player, including odd score and both team ends',()=>{
 const m=new DoublesMatch();m.start();begin(m);lose(m,'cpu');begin(m);lose(m,'player');assert.equal(m.score.player,1);assert.equal(m.serverId,'barbarian');begin(m);lose(m,'cpu');begin(m);lose(m,'cpu');assert.equal(m.serverId,'rogue');assert.equal(m.serveX,1.5);assert.equal(m.serverNumber,1);assert.equal(m.scoreCall,'1-0-1');
});
test('all four designated server positions constrain correct local half behind baseline; release at serve',()=>{
 const m=new DoublesMatch();m.start();for(const id of ['ranger','rogue','barbarian','mage'] as ActorId[])for(const right of MEMBERS[TEAM[id]]){
 m.serverId=id;m.server=TEAM[id];m.right[m.server]=right;m.prepare();const p={x:0,z:0};m.constrainActor(id,p);assert.ok(p.x*Math.sign(m.serveX)>.23);assert.ok(p.z*endSign(m.server)>6.94);const mate={x:-p.x,z:2};assert.equal(m.constrainActor(m.partner(id),mate),false);m.drop();assert.ok(m.serveActor(id,p));p.x=-p.x;p.z=endSign(m.server)*3;assert.equal(m.constrainActor(id,p),false);
 }
});
test('wrong server and wrong designated returner fault the responsible team',()=>{
 const m=new DoublesMatch();m.start();m.drop();assert.equal(m.serveActor('rogue',m.servePosition),false);assert.equal(m.pending?.loser,'player');m.start();begin(m);m.bounce({x:-1.5,z:-5},1);assert.equal(m.hitActor('mage',{x:-1.5,z:-5},1),false);assert.equal(m.pending?.loser,'cpu');
});
test('both mandatory bounces apply by team; either teammate can hit after the designated return',()=>{
 const m=new DoublesMatch();m.start();begin(m);assert.equal(m.hitActor('barbarian',{x:-1.5,z:-4},0),false);assert.match(m.pending!.reason,/투바운스/);
 m.start();begin(m);m.bounce({x:-1.5,z:-5},1);assert.ok(m.hitActor('barbarian',{x:-1.5,z:-5},1));assert.equal(m.hitActor('rogue',{x:0,z:4},0),false);
 m.start();begin(m);m.bounce({x:-1.5,z:-5},1);m.hitActor('barbarian',{x:-1.5,z:-5},1);m.bounce({x:1,z:4},1);assert.ok(m.hitActor('rogue',{x:1,z:4},1));assert.equal(m.hits,3);assert.ok(m.hitActor('mage',{x:0,z:-2.7},0));assert.equal(m.hits,4);
});
function freeRally(){const m=new DoublesMatch();m.start();begin(m);m.hits=3;m.bounceRequired={player:false,cpu:false};return m;}
test('kitchen volley forbidden, bounced kitchen hit legal',()=>{let m=freeRally();assert.equal(m.hitActor('mage',{x:0,z:-2},0),false);assert.match(m.pending!.reason,/키친/);m=freeRally();assert.ok(m.hitActor('mage',{x:0,z:-2},1));});
test('partner in kitchen does not cause hitter fault; actual volley momentum does',()=>{
 const m=freeRally();assert.ok(m.hitActor('mage',{x:0,z:-2.7},0));m.updateActorFeet('barbarian',{x:1,z:-1},.7,false);assert.equal(m.phase,'rally');m.updateActorFeet('mage',{x:0,z:-2.1},.1,true);assert.equal(m.pending?.loser,'cpu');
});
test('airborne departure and momentum watch remain specific to the volleying actor',()=>{const m=freeRally();m.updateActorFeet('mage',{x:0,z:-1},.1,false);assert.equal(m.hitActor('mage',{x:0,z:-2.8,grounded:false},0),false);assert.match(m.pending!.reason,/도약/);});
test('serve diagonal, kitchen serve, out, net and double bounce retain rally faults',()=>{
 for(const [p,reason] of [[{x:1.5,z:-5},/대각선/],[{x:-1,z:-1},/키친/],[{x:-4,z:-5},/아웃/]] as const){const m=new DoublesMatch();m.start();begin(m);m.bounce(p,1);assert.match(m.pending!.reason,reason);}
 const n=new DoublesMatch();n.start();begin(n);n.net();assert.equal(n.pending?.loser,'player');const b=freeRally();b.bounce({x:0,z:-4},2);assert.equal(b.pending?.loser,'cpu');
});
test('11 points requires two-point margin; only serving team scores',()=>{
 const m=new DoublesMatch();m.start();m.score={player:10,cpu:10};begin(m);lose(m,'cpu');assert.equal(m.phase,'between');assert.equal(m.score.player,11);begin(m);lose(m,'cpu');assert.equal(m.phase,'over');assert.equal(m.winner,'player');assert.match(doublesTitle(m.doublesResult!),/YOU WIN/);
});
