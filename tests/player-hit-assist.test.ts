import {test} from 'node:test';import assert from 'node:assert/strict';
import {Vector3,PerspectiveCamera,Group,Mesh,RingGeometry,MeshBasicMaterial} from 'three';
import {PracticeBall} from '../src/ball.ts';import {canContact} from '../src/volley.ts';
import {PlayerHitAssist,canPlayerContact,legalPlayerContact,playerTiming,forecastPlayerContact,INPUT_BUFFER_SECONDS,PLAYER_REACH,type PlayerHitContext,type PlayerHitEvent} from '../src/player-hit-assist.ts';
import {PlayerTimingVisual,TIMING_COLORS} from '../src/player-timing-visual.ts';
import {SinglesMatch} from '../src/match.ts';
function fixture(overrides:Partial<PlayerHitContext>={}):PlayerHitContext {
 const ball=new PracticeBall();ball.launch(new Vector3(.35,1.3,2.2),new Vector3(0,1,9));
 return {ball,feet:new Vector3(0,.045,4),velocity:new Vector3(),speed:1,role:'return',mustBounce:false,volleyAllowed:true,...overrides};
}
function simulate(a:PlayerHitAssist,c:PlayerHitContext){const events:PlayerHitEvent[]=[...a.advance(0,c)];for(let i=0;i<60&&a.pending;i++){c.ball.step(1/240,c.role==='serve');c.feet.addScaledVector(c.velocity,1/240);events.push(...a.advance(1/240,c));}return events;}
test('human contact envelope is 30% wider; drive/dink can reach both lateral edges while CPU remains strict',()=>{
 assert.equal(PLAYER_REACH,1.05*1.3);const feet=new Vector3(0,.045,4);
 for(const x of [1.2,-1.0]){const b=new Vector3(x,1.2,3.5);assert.equal(canContact(feet,b),false);assert.equal(canPlayerContact(feet,b),true);}
 for(const b of [new Vector3(2,1.2,3.5),new Vector3(.3,2.5,3.5),new Vector3(.3,.1,3.5),new Vector3(.3,1.2,4.4)])assert.equal(canPlayerContact(feet,b),false);
});
test('read-only prediction uses real gravity and existing velocity without moving ball or player',()=>{const c=fixture(),p=c.ball.position.clone(),v=c.ball.velocity.clone(),feet=c.feet.clone();const plan=forecastPlayerContact(c,.2,true);assert.ok(plan&&plan.time>0&&plan.time<=.2);assert.deepEqual(c.ball.position,p);assert.deepEqual(c.ball.velocity,v);assert.deepEqual(c.feet,feet);assert.equal(c.ball.bounces,0);});
test('yellow upcoming, green actual, and paddle cues use the same legal contact predicate',()=>{const c=fixture();assert.equal(playerTiming(c),'soon');assert.equal(legalPlayerContact(c),false);c.ball.position.set(.35,1.25,3.4);assert.equal(playerTiming(c),'now');assert.equal(legalPlayerContact(c),true);c.mustBounce=true;c.volleyAllowed=false;assert.equal(playerTiming(c),'blocked');});
test('early drive and dink clicks wait for a real contact, produce exactly one impact and retain shot type',()=>{for(const shot of ['drive','dink'] as const){const c=fixture(),a=new PlayerHitAssist();assert.equal(canPlayerContact(c.feet,c.ball.position),false);assert.ok(a.queue(shot,c));const events=simulate(a,c);assert.equal(events.filter(e=>e.kind==='impact').length,1);const start=events.find(e=>e.kind==='start');assert.ok(start&&start.delay>0);assert.equal(start.shot,shot);assert.equal(events.find(e=>e.kind==='impact')?.shot,shot);assert.equal(a.pending,null);assert.equal(canPlayerContact(c.feet,c.ball.position),true);assert.deepEqual(a.advance(.2,c),[]);}});
test('buffer lasts at most 0.2 real unpaused seconds at 0.5/0.75/1 speed',()=>{for(const speed of [.5,.75,1]){const c=fixture({speed}),a=new PlayerHitAssist();assert.ok(a.queue('drive',c));a.advance(0,c);c.ball.position.set(2.5,5,2);c.ball.velocity.set(5,10,-2);const events:PlayerHitEvent[]=[];for(let i=0;i<19;i++)events.push(...a.advance(.01*speed,c));assert.ok(a.pending);events.push(...a.advance(.011*speed,c));assert.equal(a.pending,null);assert.equal(events.filter(e=>e.kind==='impact').length,0);assert.equal(events.filter(e=>e.kind==='miss').length,1);}});
test('an input about 0.2s early can meet a slow incoming ball without extending expiry',()=>{const c=fixture();c.ball.position.set(.35,1.7,1.75);c.ball.velocity.set(0,.5,5);const a=new PlayerHitAssist();assert.ok(a.queue('dink',c));const events=simulate(a,c);const start=events.find(e=>e.kind==='start');assert.ok(start&&start.delay>=.15&&start.delay<=INPUT_BUFFER_SECONDS);assert.ok(events.some(e=>e.kind==='impact'));});
test('fast approaching ball that would leave by the old fixed swing delay gets an earlier actual contact',()=>{const c=fixture();c.ball.position.set(.65,1.25,3.9);c.ball.velocity.set(0,0,12);const a=new PlayerHitAssist();assert.equal(playerTiming(c),'now');assert.ok(a.queue('drive',c));const events=a.advance(0,c);const start=events.find(e=>e.kind==='start');assert.ok(start&&start.delay<.065);const all=[...events,...simulate(a,c)];assert.equal(all.filter(e=>e.kind==='impact').length,1);});
test('distant, already-passed, fleeing and expired balls never auto-hit',()=>{for(const [point,velocity] of [[new Vector3(4,1,1),new Vector3(0,0,10)],[new Vector3(.3,1,4.4),new Vector3(0,0,5)],[new Vector3(.3,1,2),new Vector3(0,0,-10)]] as const){const c=fixture();c.ball.launch(point,velocity);const a=new PlayerHitAssist();assert.equal(a.queue('drive',c),false);assert.equal(playerTiming(c),'idle');assert.deepEqual(a.advance(.3,c),[]);}});
test('a click is required: forecasts and visual hints never arm an automatic swing',()=>{const c=fixture(),a=new PlayerHitAssist();for(let i=0;i<30;i++){playerTiming(c);assert.deepEqual(a.advance(1/240,c),[]);}assert.equal(a.pending,null);});
test('rally changes, inactive balls and explicit reset clear old queued clicks',()=>{for(const cancel of ['turn','inactive','reset']){const c=fixture(),a=new PlayerHitAssist();a.queue('drive',c);if(cancel==='turn')c.role='none';else if(cancel==='inactive')c.ball.active=false;else a.clear();assert.deepEqual(a.advance(.01,c),[]);assert.equal(a.pending,null);}});
test('serve buffer waits for drop bounce; mandatory return bounces and kitchen volley faults remain rule decisions',()=>{
 const c=fixture({role:'serve',mustBounce:true,volleyAllowed:false});c.feet.set(1.5,.045,7.3);c.ball.launch(new Vector3(1.82,.18,7.05),new Vector3(0,-1,0));const a=new PlayerHitAssist();assert.ok(a.queue('drive',c));assert.ok(simulate(a,c).some(e=>e.kind==='impact'));assert.equal(c.ball.bounces,1);
 const m=new SinglesMatch();m.start();m.phase='rally';m.lastHitter='cpu';m.bounceRequired.player=true;assert.equal(m.hit('player',{x:0,z:4},0),false);assert.match(m.pending!.reason,/투바운스/);
 const k=fixture();k.feet.z=2;k.ball.position.set(.35,1.2,1.5);assert.equal(playerTiming(k),'blocked');assert.equal(legalPlayerContact(k),false);k.ball.bounces=1;assert.equal(playerTiming(k),'now');
});
test('doubles wrong designated receiver does not receive green legal timing',()=>{const c=fixture({designated:false});c.ball.position.set(.35,1.2,3.5);assert.equal(playerTiming(c),'blocked');});
test('ground ring and player-only paddle marker match now/soon and disappear for illegal volleys',()=>{
 const ring=new Mesh(new RingGeometry(1.21,1.24),new MeshBasicMaterial()),visual=new PlayerTimingVisual(ring),camera=new PerspectiveCamera(46,1,.1,100),paddle=new Group();camera.position.set(1.8,11.4,17);
 const c=fixture();visual.update(playerTiming(c),c,paddle,camera,false,900);assert.equal(ring.material.color.getHex(),TIMING_COLORS.soon);assert.equal(visual.paddleCue.visible,true);
 c.ball.position.set(.35,1.2,3.5);visual.update(playerTiming(c),c,paddle,camera,false,900);assert.equal(ring.material.color.getHex(),TIMING_COLORS.now);assert.equal(visual.paddleCue.visible,true);
 c.mustBounce=true;c.volleyAllowed=false;visual.update(playerTiming(c),c,paddle,camera,false,900);assert.equal(visual.paddleCue.visible,false);c.role='none';visual.update(playerTiming(c),c,paddle,camera,false,900);assert.equal(ring.visible,false);
});

test('runtime buffer expires after real 0.2s even with slow frames, and resetting clock excludes pauses',()=>{
 let now=10;const c=fixture(),a=new PlayerHitAssist(()=>now);assert.ok(a.queue('drive',c));a.advance(0,c);
 now+=.1;a.advance(.001,c);assert.ok(a.pending);assert.ok(Math.abs(a.pending.age-.1)<1e-8);
 now+=30;a.resetClock();a.advance(0,c);assert.ok(a.pending);assert.ok(Math.abs(a.pending.age-.1)<1e-8);
 now+=.101;const events=a.advance(.001,c);assert.equal(a.pending,null);assert.equal(events[0].kind,'miss');
});

test('slow render frame can finish an already-valid click, but never rescues an actually departed ball',()=>{
 for(const departed of [false,true]){let now=0;const c=fixture();c.ball.position.set(1.2,1.2,3.5);c.ball.bounces=1;const a=new PlayerHitAssist(()=>now);assert.ok(a.queue('drive',c));a.advance(0,c);if(departed)c.ball.position.z=4.7;now=.3;const events=a.advance(.008,c);assert.equal(events[0].kind,departed?'miss':'impact');assert.equal(a.pending,null);}
});
