import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectLanguage,getLanguage,setLanguage,t,localizeText} from '../src/i18n/index.ts';
import {ko} from '../src/i18n/ko.ts';
import {en} from '../src/i18n/en.ts';
import {SinglesMatch} from '../src/match.ts';
import {DoublesMatch} from '../src/doubles-match.ts';

test('saved valid locale wins; Korean browser variants select ko; all other browsers select en',()=>{
 for(const locale of ['ko','ko-KR','KO-kr'])assert.equal(detectLanguage(null,locale),'ko');
 for(const locale of ['en-US','ja-JP','fr',''])assert.equal(detectLanguage(null,locale),'en');
 assert.equal(detectLanguage('en','ko-KR'),'en');assert.equal(detectLanguage('ko','en-US'),'ko');assert.equal(detectLanguage('invalid','ko-KR'),'ko');
});
test('both catalogs interpolate variables and missing Korean keys use English safely',()=>{
 const previous=getLanguage();try{setLanguage('ko');assert.equal(t('fallback.example'),'English fallback');assert.equal(t('not.present'),'Unavailable');assert.equal(t('not.present',{},'Fallback'),'Fallback');
 for(const key of Object.keys(ko)){assert.ok(en[key],`Missing English: ${key}`);const names=[...ko[key].matchAll(/\{(\w+)\}/g)].map(m=>m[1]);assert.deepEqual(names.sort(),[...en[key].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),key);}
 setLanguage('en');for(const source of Object.values(ko)){const sample=source.replace(/\{\w+\}/g,'CPU 1');assert.doesNotMatch(localizeText(sample),/[가-힣]/,source);}
 }finally{setLanguage(previous);}
});
test('legacy rule reasons remain intact while net, kitchen, two-bounce and service UI translate',()=>{
 const previous=getLanguage();try{setLanguage('en');
 const reasons=['네트에 걸렸습니다.','아웃!','투바운스 룰: 서브와 첫 리턴은 각각 바운드한 뒤 쳐야 합니다.','키친 발리 반칙: 타격 후 관성 이동으로 키친에 들어갔습니다.'];
 for(const reason of reasons){assert.doesNotMatch(localizeText(`나 폴트 · ${reason}`),/[가-힣]/);}
 assert.match(localizeText(reasons[0]),/Net fault/);assert.match(localizeText(reasons[2]),/Two-bounce/);assert.match(localizeText(reasons[3]),/Kitchen volley fault/);
 assert.equal(localizeText('0-0-2 · 나 두 번째 서버 유지'),'0-0-2 · YOU · second server retained');
 assert.equal(localizeText('POINT! - 나 득점'),'POINT! - YOU scores');
 }finally{setLanguage(previous);}
});
test('switching locale never changes singles/doubles match state or serve order',()=>{
 const previous=getLanguage();try{for(const match of [new SinglesMatch(),new DoublesMatch()]){match.start();const before=JSON.stringify(match);setLanguage('ko');setLanguage('en');assert.equal(JSON.stringify(match),before);}}finally{setLanguage(previous);}
});
