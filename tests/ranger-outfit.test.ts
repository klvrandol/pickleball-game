import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
function glb(bytes:Buffer){const size=bytes.readUInt32LE(12);return{doc:JSON.parse(bytes.subarray(20,20+size).toString()),bin:bytes.subarray(28+size)};}
const source=await readFile(new URL('../Ranger.glb',import.meta.url));
const original=glb(source),sports=glb(await readFile(new URL('../public/models/Ranger-sports.glb',import.meta.url)));
function attribute(model:ReturnType<typeof glb>,index:number){
 const a=model.doc.accessors[index],v=model.doc.bufferViews[a.bufferView],width=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16} as Record<string,number>)[a.type];
 const componentBytes=({5126:4,5123:2,5121:1} as Record<number,number>)[a.componentType];assert.ok(componentBytes);
 return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,j)=>{
  const offset=(v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??width*componentBytes)+j*componentBytes;
  return a.componentType===5126?model.bin.readFloatLE(offset):a.componentType===5123?model.bin.readUInt16LE(offset):model.bin.readUInt8(offset);
 }));
}
function head(model:ReturnType<typeof glb>){
 const mesh=model.doc.meshes.find((m:{name:string})=>m.name==='Ranger_Head');
 const p=mesh.primitives[0],positions=attribute(model,p.attributes.POSITION),uv=attribute(model,p.attributes.TEXCOORD_0);
 const joints=attribute(model,p.attributes.JOINTS_0),weights=attribute(model,p.attributes.WEIGHTS_0);
 const node=model.doc.nodes.find((n:{mesh?:number})=>n.mesh===model.doc.meshes.indexOf(mesh));
 const boneNames=model.doc.skins[node.skin].joints.map((i:number)=>model.doc.nodes[i].name);
 return positions.map((xyz,i)=>({p:xyz,uv:uv[i],
  skin:JSON.stringify(joints[i].map((b,j)=>[boneNames[b],Math.round(weights[i][j]*1e4)]).filter(v=>Number(v[1])>0).sort())}));
}
test('sports outfit preserves original Ranger source, face/hair geometry, UVs and head skin weights',async()=>{
 assert.equal(createHash('sha256').update(source).digest('hex'),'3a0b0166b9d61d58dcaaa739c3cc0538be46e00d2928dd5cb513d9a41770d2e9');
 assert.deepEqual(await readFile(new URL('../public/models/Ranger.glb',import.meta.url)),source);
 // Export may split vertices at normal seams. Compare geometry/UV/weights in
 // both directions with float-export tolerance, independent of duplicate indices.
 const a=head(original),b=head(sports);
 const matches=(x:typeof a[number],y:typeof a[number])=>x.skin===y.skin&&x.p.every((v,i)=>Math.abs(v-y.p[i])<2e-5)&&x.uv.every((v,i)=>Math.abs(v-y.uv[i])<2e-5);
 assert.ok(a.every(x=>b.some(y=>matches(x,y))),'original head vertices retained');
 assert.ok(b.every(x=>a.some(y=>matches(x,y))),'no changed head vertices');
 const bones=(m:typeof sports)=>m.doc.skins[0].joints.map((i:number)=>m.doc.nodes[i].name).sort();
 assert.deepEqual(bones(sports),bones(original));assert.equal(bones(sports).length,23);
 const bind=(m:typeof sports)=>{const skin=m.doc.skins[0],matrices=attribute(m,skin.inverseBindMatrices);return Object.fromEntries(skin.joints.map((n:number,i:number)=>[m.doc.nodes[n].name,matrices[i]]));};
 const oldBind=bind(original),newBind=bind(sports);
 for(const name of bones(original))assert.ok(oldBind[name].every((v:number,i:number)=>Math.abs(v-newBind[name][i])<1e-5),`bind pose ${name}`);
});
test('adventure equipment is absent and separate sports garment surfaces/materials replace it',()=>{
 const names=sports.doc.meshes.map((m:{name:string})=>m.name);
 assert.ok(!names.some((n:string)=>/Cape|Quiver|Ranger_Body/.test(n)));
 for(const part of ['Sports_Jersey','Sports_ShortsLeft','Sports_ShortsRight','Sports_Collar','Sports_WristbandRight','Sports_LaceLeft'])assert.ok(names.includes(part),part);
 const materials=sports.doc.materials.map((m:{name:string})=>m.name);
 for(const name of ['Sports_Shirt_Blue','Sports_Shorts_Navy','Sports_Trim_White','Sports_Skin','ranger'])assert.ok(materials.includes(name),name);
});
