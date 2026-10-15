import './model-fixture.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3, SkinnedMesh } from 'three';
import { createAthlete, animateAthlete } from '../src/athlete.ts';
function point(b: import('three').Object3D) { return b.getWorldPosition(new Vector3()); }
test('only the default player uses the new SD model; CPU and comparison option retain the original asset',()=>{
 const sd=createAthlete('player',3,0),cpu=createAthlete('cpu',-3,Math.PI),classic=createAthlete('player',3,0,'classic');
 assert.equal(sd.style,'sd');assert.equal(cpu.style,'classic');assert.equal(classic.style,'classic');
 assert.notEqual(sd.model.getObjectByName('Head')!.uuid,cpu.model.getObjectByName('Head')!.uuid);
 assert.equal(sd.paddleReach,.07+.34*1.18);assert.ok(Math.abs(cpu.paddleReach-.41)<1e-12);
 assert.notEqual(sd.swingRig!.clips['forehand-drive'].uuid,cpu.swingRig!.clips['forehand-drive'].uuid);
 assert.equal(classic.swingRig!.clips['forehand-drive'].uuid,cpu.swingRig!.clips['forehand-drive'].uuid);
});
test('SD has approximately three-head proportions and genuinely shorter arms/legs, not only a bigger head',()=>{
 const sd=createAthlete('player',0,0),classic=createAthlete('player',0,0,'classic');
 let sole=Infinity;
 const head=new Box3();sd.model.traverse(o=>{if(o instanceof SkinnedMesh){const indices=o.geometry.getAttribute('skinIndex'),weights=o.geometry.getAttribute('skinWeight');
  for(let i=0;i<indices.count;i++){
   const joint=o.skeleton.bones[indices.getX(i)].name,p=o.localToWorld(o.getVertexPosition(i,new Vector3()));
   if(weights.getX(i)>.9 && joint==='Head')head.expandByPoint(p);
   if(joint==='FootL'||joint==='FootR')sole=Math.min(sole,p.y);
  }
 }});
 const body=new Box3().setFromObject(sd.model,true).getSize(new Vector3());const ratio=body.y/head.getSize(new Vector3()).y;
 assert.ok(sole>0.035 && sole<0.055,`sole=${sole}`);
 assert.ok(ratio>2.7 && ratio<3.3,`ratio=${ratio}`);
 const arm=(a:typeof sd)=>point(a.arms[1]).distanceTo(point(a.elbows[1]))+point(a.elbows[1]).distanceTo(point(a.wrists[1]));
 const leg=(a:typeof sd)=>point(a.legs[1]).distanceTo(point(a.knees[1]))+point(a.knees[1]).distanceTo(point(a.feet[1]));
 assert.ok(arm(sd)<arm(classic)*.9);assert.ok(leg(sd)<leg(classic)*.75);assert.ok(head.getSize(new Vector3()).x>.55);
});
test('SD ready stance bends the legs and brings the larger paddle forward without changing the gameplay root',()=>{
 const a=createAthlete('player',3,0),root=a.group.position.clone(),knee=a.knees[0].quaternion.clone();
 animateAthlete(a,{walking:false,phase:0,swingLeft:0,shot:'drive',lateral:0,side:1,ready:true,dt:1/60,time:0,reduceMotion:false});
 assert.ok(a.group.position.equals(root));assert.ok(a.knees[0].quaternion.angleTo(knee)>.03);
 const face=a.paddle.localToWorld(new Vector3(0,-.34,0));assert.ok(face.z<2.7);assert.ok(face.y>.8);
 a.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
});
