// Validate the exact dist artifact, without network requests or changes to source assets.
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('dist'),base='/pickleball-game/';
for(const page of ['index.html','singles.html','doubles.html','animation-test.html']){
 const html=await readFile(path.join(root,page),'utf8');
 const assets=[...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg))"/g)].map(m=>m[1]);assert(assets.length,`${page}: no scripts/styles`);
 for(const asset of assets){assert(asset.startsWith(base),`${page}: incorrect base ${asset}`);assert((await stat(path.join(root,asset.slice(base.length)))).size>0);}
}
const names=['Ranger','Rogue','Barbarian','Mage'];
for(const name of names)for(const suffix of ['','-sports']){
 const file=`models/${name}${suffix}.glb`;assert.deepEqual(await readFile(path.join(root,file)),await readFile(path.join('public',file)),`${file} was changed during build`);
}
const glbs=[...names.flatMap(name=>['', '-sports'].map(suffix=>`models/${name}${suffix}.glb`)),...(await readdir(path.join(root,'assets'))).filter(file=>file.endsWith('.glb')).map(file=>'assets/'+file)];
let embeddedImages=0;
for(const file of glbs){
 const bytes=await readFile(path.join(root,file));assert.equal(bytes.toString('ascii',0,4),'glTF',file);assert.equal(bytes.readUInt32LE(8),bytes.length,file);
 const size=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+size).toString('utf8'));
 for(const buffer of json.buffers??[])assert(!buffer.uri,`${file}: external buffer ${buffer.uri}`);
 for(const image of json.images??[]){assert.equal(typeof image.bufferView,'number',`${file}: external image`);const view=json.bufferViews[image.bufferView];assert(view&&view.byteLength>0);assert((view.byteOffset??0)+view.byteLength<=json.buffers[0].byteLength);embeddedImages++;}
}
for(const file of ['ASSET-CREDITS.md','licenses/KAYKIT-ADVENTURERS-LICENSE.txt','licenses/QUATERNIUS-LICENSE.txt','licenses/THREE-LICENSE.txt','licenses/VITE-LICENSE.md'])assert((await stat(path.join(root,file))).size>0,file);
console.log(`PASS Pages artifact: 4 entrypoints, ${glbs.length} GLBs, ${embeddedImages} embedded textures, original bytes and notices preserved.`);
console.log('License provenance sign-off remains separate; this check is not permission to publish.');
