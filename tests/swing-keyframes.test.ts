import './model-fixture.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, QuaternionKeyframeTrack, Quaternion, Vector3 } from 'three';
import { createAthlete, animateAthlete } from '../src/athlete.ts';
import { SwingMotion } from '../src/swing.ts';
import { SWING_PROFILES, sampleSwingKey } from '../src/swing-keyframes.ts';
function at(actor: ReturnType<typeof createAthlete>, motion: SwingMotion, time: number, moving = false) {
  motion.age = time < .5 ? time*2*motion.contactAt : motion.contactAt+(time-.5)*2*motion.finishTime;
  animateAthlete(actor,{motion,walking:moving,phase:time*8,swingLeft:0,shot:motion.shot,lateral:moving?2:0,forward:0,side:1,ready:true,dt:0,time:0,reduceMotion:false});
}
function stroke(profile: typeof SWING_PROFILES[number], team: 'player'|'cpu' = 'player', height = 1.15) {
  const actor=createAthlete(team,team==='cpu'?-3:3,team==='cpu'?Math.PI:0),motion=new SwingMotion();
  const target=actor.group.localToWorld(new Vector3(profile.hand==='forehand'?.35:-.35,height-.045,-.55));
  motion.begin(actor.group.position,target,actor.group.rotation.y,profile.kind==='dink'?'dink':'drive',profile.kind==='volley');
  return {actor,motion,target};
}
test('six distinct actual AnimationClips contain sampled skeletal quaternion and translation tracks',()=>{
  const actor=createAthlete('player',3,0),clips=actor.swingRig!.clips;
  assert.equal(Object.keys(clips).length,6);
  for(const profile of SWING_PROFILES){const clip=clips[profile.id];assert.ok(clip instanceof AnimationClip);assert.equal(clip.duration,1);assert.ok(clip.tracks.length>=50);
    for(const joint of ['Body','Abdomen','Torso','UpperArmR','LowerArmR','PalmR','UpperLegL','LowerLegL']) {
      const track=clip.tracks.find(t=>t.name===joint+'.quaternion');assert.ok(track instanceof QuaternionKeyframeTrack);assert.equal(track.times.length,61);
    }
  }
  const body=clips['forehand-drive'].tracks.find(t=>t.name==='Body.quaternion')!;
  assert.ok(Array.from(body.values).some((value,i)=>Math.abs(value-(i%4===3?1:0))>.04));
});
test('drive unloads hips before torso and shoulder; dink loads knees; volley keeps torso stable',()=>{
  const drive=SWING_PROFILES[0],wind=sampleSwingKey(drive,.30),release=sampleSwingKey(drive,.43);
  assert.ok(release.chain[0]>0 && release.chain[1]<0 && release.chain[2]<0);
  assert.ok(wind.chain[1]<-.3);
  const dink=sampleSwingKey(SWING_PROFILES[2],.34),volley=sampleSwingKey(SWING_PROFILES[4],.34);
  assert.ok(dink.lower[0]<-.14);assert.ok(Math.abs(volley.chain[1])<.05);
  assert.notDeepEqual(SWING_PROFILES[0].keys.map(k=>k.paddle),SWING_PROFILES[1].keys.map(k=>k.paddle.map(v=>-v)));
});
test('both players and all six strokes contact low/normal/high balls with wrist rotation after keyframes',()=>{
  for(const profile of SWING_PROFILES)for(const team of ['player','cpu'] as const)for(const height of [.6,1.15,1.65]){
    const {actor,motion,target}=stroke(profile,team,height);motion.aimAt(actor.group.position,new Vector3(1,0,team==='cpu'?5:-5),actor.group.rotation.y);at(actor,motion,.5);
    const face=actor.paddle.localToWorld(new Vector3(0,-.34,0));assert.ok(face.distanceTo(target)<.02,`${profile.id}/${team}/${height}: ${face.distanceTo(target)}`);
    assert.ok(actor.wrists[1].quaternion.angleTo(new Quaternion())>.01);
  }
});
test('standing strokes keep both feet fixed horizontally while loading knees, then return to the native stance',()=>{
  for(const profile of SWING_PROFILES){const {actor,motion}=stroke(profile);at(actor,motion,0);const feet=actor.feet.map(f=>f.getWorldPosition(new Vector3()));const before=actor.chest.quaternion.clone();let kneeChange=false;
    for(let i=1;i<=60;i++){at(actor,motion,i/60);actor.feet.forEach((f,j)=>{const p=f.getWorldPosition(new Vector3());assert.ok(Math.hypot(p.x-feet[j].x,p.z-feet[j].z)<1e-5);assert.ok(p.y>=feet[j].y-.001 && p.y<feet[j].y+.025);});
      kneeChange ||= actor.knees[0].quaternion.angleTo(actor.bind.get(actor.knees[0])!.quaternion)>.03;
      actor.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
    }
    assert.ok(kneeChange);assert.ok(actor.chest.quaternion.angleTo(before)<.001);
  }
});
test('moving strokes preserve root movement and use current gait foot targets instead of stale planted anchors',()=>{
  const {actor,motion}=stroke(SWING_PROFILES[0]);
  for(let i=0;i<20;i++){actor.group.position.x+=.03;at(actor,motion,i/20,true);assert.ok(Math.abs(actor.feet[0].getWorldPosition(new Vector3()).x-actor.group.position.x)<.5);}
  assert.ok(Math.abs(actor.group.position.x-.6)<1e-9);
});
test('visual clip time lands on impact without changing the existing contact delay, and pause sampling is repeatable',()=>{
  const {actor,motion}=stroke(SWING_PROFILES[0]);assert.equal(motion.contactAt,.065);motion.advance(.065);assert.equal(motion.clipTime,.5);at(actor,motion,.62);
  const bones=[actor.body,actor.chest,...actor.arms,...actor.wrists,...actor.knees];const sample=bones.map(b=>b.quaternion.clone());
  for(let i=0;i<20;i++)at(actor,motion,.62);
  bones.forEach((b,i)=>assert.ok(b.quaternion.angleTo(sample[i])<1e-6));
});
