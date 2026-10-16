import './model-fixture.ts';
import {readFile} from 'node:fs/promises';import {test} from 'node:test';import assert from 'node:assert/strict';
import {Box3,Vector3,SkinnedMesh} from 'three';import {installAthleteModel} from '../src/athlete-model.ts';
import {createAthlete,animateAthlete} from '../src/athlete.ts';import {SwingMotion} from '../src/swing.ts';import {SWING_PROFILES} from '../src/swing-keyframes.ts';
for(const [name,style,team] of [['Rogue','rogue','player'],['Mage','mage','cpu']] as const){
const bytes=await readFile(new URL(`../public/models/${name}-sports.glb`,import.meta.url));
const size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size).toString());
// Node-only geometry test omits image decoding; Chromium loads the complete GLB.
for(const material of doc.materials)delete material.pbrMetallicRoughness.baseColorTexture;
delete doc.images;delete doc.textures;delete doc.samplers;
const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
const bin=bytes.subarray(20+size),header=Buffer.alloc(20);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+bin.length,8);
header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
const data=Buffer.concat([header,padded,bin]);
await installAthleteModel(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),style);

test(`${name} preserves original source, face, 23-bone skin, fitted court size and right-hand paddle`,async()=>{
 assert.deepEqual(await readFile(new URL(`../public/models/${name}.glb`,import.meta.url)),await readFile(new URL(`../${name}.glb`,import.meta.url)));
 const a=createAthlete(team,team==='player'?3:-3,team==='player'?0:Math.PI,style);assert.equal(a.paddle.parent!.name,'handr');
 const bounds=new Box3().setFromObject(a.model,true);assert.ok(Math.abs(bounds.min.y-.045)<.02);assert.ok(Math.abs(bounds.max.y-bounds.min.y-1.17)<.025);
 const meshes:SkinnedMesh[]=[];a.model.traverse(o=>{if(o instanceof SkinnedMesh)meshes.push(o);});assert.ok(meshes.length>10);assert.equal(meshes[0].skeleton.bones.length,23);
 const names=doc.meshes.map((m:{name:string})=>m.name);assert.ok(!names.some((n:string)=>/Cape|Hat|Quiver/.test(n)));assert.ok(names.includes(name+'_Head'));
 for(const part of ['Sports_Skirt','Sports_Jersey','Sports_ShortsLeft','Sports_ShortsRight','Sports_LaceLeft'])assert.ok(names.includes(part),part);
 const skirt=doc.meshes.find((m:{name:string})=>m.name==='Sports_Skirt');assert.ok(skirt.primitives[0].attributes.WEIGHTS_0!==undefined);
 assert.ok(doc.materials.some((m:{name:string})=>m.name===`Sports_Shirt_${team==='player'?'Blue':'Red'}`));
});
test(`${name} six swing contacts preserve root and finite skinned skirt through locomotion`,()=>{
 const a=createAthlete(team,team==='player'?3:-3,team==='player'?0:Math.PI,style),root=a.group.position.clone(),facing=team==='player'?0:Math.PI,sign=team==='player'?1:-1;
 for(const height of [.55,1.15,1.65])for(const profile of SWING_PROFILES){const b=new Vector3(sign*(profile.hand==='forehand'?.35:-.35),height,root.z-sign*.55),motion=new SwingMotion();motion.begin(root,b,facing,profile.kind==='dink'?'dink':'drive',profile.kind==='volley');motion.age=motion.contactAt;
 animateAthlete(a,{motion,walking:true,phase:.7,swingLeft:0,shot:motion.shot,lateral:1,side:1,ready:true,dt:1/60,time:0,reduceMotion:false});assert.ok(a.paddle.localToWorld(new Vector3(0,-.34,0)).distanceTo(b)<.025,`${profile.id}/${height}`);assert.deepEqual(a.group.position.toArray(),root.toArray());for(const bone of a.bind.keys())assert.ok(bone.matrixWorld.elements.every(Number.isFinite));}
});
}
