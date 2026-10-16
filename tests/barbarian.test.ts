import './model-fixture.ts';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3, SkinnedMesh } from 'three';
import { installAthleteModel } from '../src/athlete-model.ts';
import { createAthlete, animateAthlete } from '../src/athlete.ts';
import { SwingMotion } from '../src/swing.ts';
import { SWING_PROFILES } from '../src/swing-keyframes.ts';
const bytes=await readFile(new URL('../public/models/Barbarian-sports.glb',import.meta.url));
const size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size).toString());
// Node-only geometry test omits image decoding; Chromium loads the complete GLB.
for(const material of doc.materials)delete material.pbrMetallicRoughness.baseColorTexture;
delete doc.images;delete doc.textures;delete doc.samplers;
const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
const bin=bytes.subarray(20+size),header=Buffer.alloc(20);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+bin.length,8);
header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
const data=Buffer.concat([header,padded,bin]);
await installAthleteModel(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'barbarian');
test('Barbarian CPU keeps court root, KayKit rig, right-hand paddle and Ranger-sized sports silhouette',async()=>{
 const cpu=createAthlete('cpu',-5,Math.PI,'barbarian');
 assert.deepEqual(cpu.group.position.toArray(),[0,.045,-5]);assert.deepEqual(cpu.group.scale.toArray(),[1,1,1]);
 assert.equal(cpu.paddle.parent!.name,'handr');assert.ok(Math.abs(cpu.paddle.getWorldScale(new Vector3()).x-.65*1.15)<1e-5);
 const bounds=new Box3().setFromObject(cpu.model,true);assert.ok(Math.abs(bounds.min.y-.045)<.015);assert.ok(Math.abs(bounds.max.y-bounds.min.y-1.17)<.02);
 let skin:SkinnedMesh|undefined;cpu.model.traverse(o=>{if(o instanceof SkinnedMesh)skin=o;});assert.equal(skin!.skeleton.bones.length,23);
 assert.ok(cpu.model.getObjectByName('Barbarian_Head'));assert.ok(!cpu.model.getObjectByName('Barbarian_BearHat'));assert.ok(!cpu.model.getObjectByName('Barbarian_Body'));
 assert.ok(doc.materials.some((m:{name:string})=>m.name==='Sports_Shirt_Red'));
 assert.deepEqual(await readFile(new URL('../public/models/Barbarian.glb',import.meta.url)),await readFile(new URL('../Barbarian.glb',import.meta.url)));
});
test('six Barbarian CPU swings contact low/normal/high balls in CPU-facing coordinates without moving its gameplay root',()=>{
 const cpu=createAthlete('cpu',-3,Math.PI,'barbarian'),root=cpu.group.position.clone();
 for(const height of [.55,1.15,1.65])for(const profile of SWING_PROFILES){
  const ball=new Vector3(profile.hand==='forehand'?-.35:.35,height,-2.45),motion=new SwingMotion();
  motion.begin(root,ball,Math.PI,profile.kind==='dink'?'dink':'drive',profile.kind==='volley');motion.age=motion.contactAt;
  animateAthlete(cpu,{motion,walking:false,phase:0,swingLeft:0,shot:motion.shot,lateral:0,side:1,ready:true,dt:1/60,time:0,reduceMotion:false});
  assert.ok(cpu.paddle.localToWorld(new Vector3(0,-.34,0)).distanceTo(ball)<.02,`${profile.id}/${height}`);
  assert.deepEqual(cpu.group.position.toArray(),root.toArray());for(const b of cpu.bind.keys())assert.ok(b.matrixWorld.elements.every(Number.isFinite));
 }
});
test('Barbarian sports derivative preserves original head shape and original/KayKit bind matrices',async()=>{
 const source=await readFile(new URL('../Barbarian.glb',import.meta.url));const n=source.readUInt32LE(12),original=JSON.parse(source.subarray(20,20+n).toString()),originalBin=source.subarray(28+n),sportsBin=bytes.subarray(28+size);
 function accessor(d:typeof doc,b:Buffer,index:number,width:number){const a=d.accessors[index],v=d.bufferViews[a.bufferView];assert.equal(a.componentType,5126);return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,j)=>b.readFloatLE((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??width*4)+j*4)));}
 const head=(d:typeof doc,b:Buffer)=>accessor(d,b,d.meshes.find((m:{name:string})=>m.name==='Barbarian_Head').primitives[0].attributes.POSITION,3);
 const a=head(original,originalBin),b=head(doc,sportsBin),same=(x:number[],y:number[])=>x.every((v,i)=>Math.abs(v-y[i])<2e-5);
 assert.ok(a.every(x=>b.some(y=>same(x,y))));assert.ok(b.every(x=>a.some(y=>same(x,y))));
 const binds=(d:typeof doc,b:Buffer)=>{const skin=d.skins[0],values=accessor(d,b,skin.inverseBindMatrices,16);return Object.fromEntries(skin.joints.map((j:number,i:number)=>[d.nodes[j].name,values[i]]));};
 const oldBind=binds(original,originalBin),newBind=binds(doc,sportsBin);assert.deepEqual(Object.keys(oldBind).sort(),Object.keys(newBind).sort());
 for(const name of Object.keys(oldBind))assert.ok(oldBind[name].every((v:number,i:number)=>Math.abs(v-newBind[name][i])<1e-5),name);
});
test('CPU ready paddle clears the torso, presents its face forward and keeps the hand attachment/root',()=>{
 const cpu=createAthlete('cpu',-3,Math.PI,'barbarian'),root=cpu.group.position.clone();
 animateAthlete(cpu,{walking:false,phase:0,swingLeft:0,shot:'drive',lateral:0,side:1,ready:true,dt:0,time:0,reduceMotion:false});
 const face=cpu.group.worldToLocal(cpu.paddle.localToWorld(new Vector3(0,-.34,0)));
 assert.ok(face.z<-.20,`ready face ${face.toArray()}`);assert.ok(face.x>.25);assert.ok(face.y>.70);
 const normal=new Vector3(0,0,1).applyQuaternion(cpu.paddle.getWorldQuaternion(cpu.group.quaternion.clone()));
 assert.ok(normal.dot(new Vector3(0,.12,1).normalize())>.98);
 assert.equal(cpu.paddle.parent!.name,'handr');assert.deepEqual(cpu.group.position.toArray(),root.toArray());
 assert.ok(cpu.paddle.getObjectByName('paddle-contrast-edge'));
});
