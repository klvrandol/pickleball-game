import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicAssetUrl} from '../src/asset-url.ts';
test('all four public models respect the Pages subpath and development root',()=>{
 for(const name of ['Ranger','Rogue','Barbarian','Mage'])for(const suffix of ['','-sports']){
  const file=`models/${name}${suffix}.glb`;
  assert.equal(publicAssetUrl(file,'/pickleball-game/'),'/pickleball-game/'+file);
  assert.equal(publicAssetUrl('/'+file,'/pickleball-game'),'/pickleball-game/'+file);
  assert.equal(publicAssetUrl(file,'/'),'/'+file);
 }
});
