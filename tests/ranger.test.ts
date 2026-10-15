import './model-fixture.ts';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, SkinnedMesh, Box3 } from 'three';
import { installAthleteModel } from '../src/athlete-model.ts';
import { createAthlete, animateAthlete } from '../src/athlete.ts';
import { SwingMotion } from '../src/swing.ts';
import { SWING_PROFILES } from '../src/swing-keyframes.ts';

// Node has no image decoder. Preserve all original geometry/skin buffers; only omit
// material texture references here. The unmodified textured GLB is tested in Chromium.
const bytes=await readFile(new URL('../public/models/Ranger.glb',import.meta.url));
const jsonSize=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonSize).toString());
for(const material of doc.materials)delete material.pbrMetallicRoughness.baseColorTexture;
delete doc.images;delete doc.textures;delete doc.samplers;
const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
const bin=bytes.subarray(20+jsonSize),header=Buffer.alloc(20);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+bin.length,8);
header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
const data=Buffer.concat([header,padded,bin]);
await installAthleteModel(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'ranger');

test('Ranger uses original KayKit skin, real right-hand socket, court scale and unchanged classic CPU',()=>{
 const a=createAthlete('player',3,0,'ranger'),cpu=createAthlete('cpu',-3,Math.PI);
 assert.equal(cpu.style,'classic');assert.equal(a.paddle.parent,a.wrists[1]);assert.equal(a.wrists[1].name,'handr');
 assert.ok(a.model.getObjectByName('handslotr'));assert.equal(Object.keys(a.actions).length,0);
 const meshes:SkinnedMesh[]=[];a.model.traverse(o=>{if(o instanceof SkinnedMesh)meshes.push(o);});
 assert.equal(meshes.length,8);assert.equal(meshes[0].skeleton.bones.length,23);
 const bounds=new Box3().setFromObject(a.model,true);
 assert.ok(Math.abs(bounds.min.y-.045)<.015,`soles ${bounds.min.y}`);
 assert.ok(bounds.max.y>1.7&&bounds.max.y<1.95);
});
test('six Ranger strokes meet the actual paddle face at impact and do not move gameplay feet/root',()=>{
 const a=createAthlete('player',3,0,'ranger'),root=a.group.position.clone();
 for(const profile of SWING_PROFILES){
  const ball=new Vector3(profile.hand==='forehand'?.35:-.35,1.15,2.45),motion=new SwingMotion();
  motion.begin(a.group.position,ball,0,profile.kind==='dink'?'dink':'drive',profile.kind==='volley');motion.age=motion.contactAt;
  for(let i=0;i<3;i++)animateAthlete(a,{motion,walking:false,phase:0,swingLeft:0,shot:motion.shot,lateral:0,side:1,ready:true,dt:1/60,time:0,reduceMotion:false});
  const face=a.paddle.localToWorld(new Vector3(0,-.34,0));
  assert.ok(face.distanceTo(ball)<.02,`${profile.id}: ${face.distanceTo(ball)}`);
  assert.deepEqual(a.group.position.toArray(),root.toArray());
  for(const bone of a.bind.keys())assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
 }
});
