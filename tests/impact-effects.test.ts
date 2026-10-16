import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, PerspectiveCamera, Mesh, MeshBasicMaterial } from 'three';
import { ImpactEffects, IMPACT_DURATION } from '../src/impact-effects.ts';
test('three impact styles copy the exact contact origin without changing ball position, velocity or camera',()=>{
 const fx=new ImpactEffects(),p=new Vector3(.3,1.2,-3),v=new Vector3(2,3,8),camera=new PerspectiveCamera();const before=v.clone();
 for(const kind of ['drive','dink','volley'] as const)fx.emit(kind,p,v);
 p.set(99,99,99);fx.update(0,camera);
 assert.deepEqual(v.toArray(),before.toArray());assert.deepEqual(camera.position.toArray(),[0,0,0]);
 const colors=[0xc7efff,0xb9ef92,0xffe25c];
 fx.root.children.slice(0,3).forEach((slot,i)=>{
  assert.deepEqual(slot.position.toArray(),[.3,1.2,-3]);assert.equal(slot.visible,true);
  const [ring,rays]=slot.children[0].children;assert.equal((ring as Mesh<never,MeshBasicMaterial>).material.color.getHex(),colors[i]);
  assert.equal(ring.visible,i!==2);assert.equal(rays.visible,i!==1);
  assert.equal(slot.children[1].visible,i===0);
 });
});
test('effects expire independently within 0.1–0.25 real seconds, fade and freeze while paused',()=>{
 const fx=new ImpactEffects(),camera=new PerspectiveCamera();for(const kind of ['drive','dink','volley'] as const){assert.ok(IMPACT_DURATION[kind]>=.1&&IMPACT_DURATION[kind]<=.25);fx.emit(kind,new Vector3(),new Vector3(0,0,1));}
 fx.update(0,camera);fx.update(.06,camera);const ring=fx.root.children[0].children[0].children[0] as Mesh<never,MeshBasicMaterial>;const opacity=ring.material.opacity;
 fx.update(0,camera);assert.equal(ring.material.opacity,opacity);assert.ok(opacity>0&&opacity<.65);
 fx.update(.061,camera);assert.equal(fx.root.children[2].visible,false);assert.equal(fx.root.children[0].visible,true);
 fx.update(.041,camera);assert.equal(fx.root.children[0].visible,false);assert.equal(fx.root.children[1].visible,true);
 fx.update(.07,camera);assert.ok(fx.root.children.every(s=>!s.visible));
});
test('effect pool is bounded, reduced motion hides it, and restart clears every active flash',()=>{
 const fx=new ImpactEffects(),camera=new PerspectiveCamera();for(let i=0;i<30;i++)fx.emit('drive',new Vector3(i,0,0),new Vector3(0,0,1));
 assert.equal(fx.root.children.length,4);fx.update(0,camera,true);assert.ok(fx.root.children.every(s=>!s.visible));
 fx.emit('volley',new Vector3(),new Vector3());fx.update(0,camera);assert.ok(fx.root.children.some(s=>s.visible));fx.clear();assert.ok(fx.root.children.every(s=>!s.visible));
});
