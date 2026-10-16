import {ko} from './ko.ts';
import {en} from './en.ts';
export const LANGUAGES={ko:{label:'한국어',messages:ko},en:{label:'English',messages:en}} as const;
export type Language=keyof typeof LANGUAGES;
const isLanguage=(value:string|null):value is Language=>value!==null&&Object.hasOwn(LANGUAGES,value);
export const LANGUAGE_KEY='pickleball.language';
export function detectLanguage(saved:string|null,browserLanguage:string):Language {
  const browser=browserLanguage.toLowerCase().split('-')[0];
  return isLanguage(saved)?saved:isLanguage(browser)?browser:'en';
}
function initialLanguage():Language {
  if(typeof navigator==='undefined')return 'ko'; // Non-browser rule tests have no user locale.
  let saved=null;try{saved=localStorage.getItem(LANGUAGE_KEY);}catch{}
  return detectLanguage(saved,navigator.language);
}
let language=initialLanguage();
const listeners=new Set<()=>void>();
export function getLanguage(){return language;}
export function onLanguageChange(callback:()=>void){listeners.add(callback);return ()=>listeners.delete(callback);}
export function setLanguage(value:Language){
  if(!isLanguage(value))return;
  language=value;try{localStorage.setItem(LANGUAGE_KEY,value);}catch{}
  if(typeof document!=='undefined')document.documentElement.lang=value;
  for(const listener of listeners)listener();
}
export function t(key:string,values:Record<string,string|number>={},fallback?:string):string {
  const template=LANGUAGES[language].messages[key]??en[key]??fallback??en.unavailable;
  return template.replace(/\{(\w+)\}/g,(all,name)=>String(values[name]??all));
}
const normalize=(s:string)=>s.trim().replace(/\s+/g,' ');
const aliases=new Map<string,string>();
for(const {messages:catalog} of Object.values(LANGUAGES))for(const [key,value]of Object.entries(catalog))if(!value.includes('{'))aliases.set(normalize(value),key);
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates=Object.values(LANGUAGES).flatMap(({messages:catalog})=>Object.entries(catalog).filter(([,s])=>s.includes('{')).map(([key,raw])=>{
 const source=normalize(raw),names=[...source.matchAll(/\{(\w+)\}/g)].map(m=>m[1]);
 return {key,names,source,regex:new RegExp('^'+source.split(/\{\w+\}/).map(escape).join('(.+?)')+'$'),weight:source.replace(/\{\w+\}/g,'').length};
})).sort((a,b)=>b.weight-a.weight);
const fragments=[...Object.entries(ko)].filter(([,s])=>!s.includes('{')&&s.length>1).sort((a,b)=>b[1].length-a[1].length);
const fragmentRegex=new RegExp(fragments.map(([,s])=>escape(s)).join('|'),'g');
const fragmentKeys=new Map(fragments.map(([key,s])=>[s,key]));
/** Presentation adapter for legacy rule/AI messages. Never mutates their authoritative strings. */
const messageCache=new Map<string,string>();
export function localizeText(source:string,depth=0):string {
 const cacheKey=language+source;const cached=messageCache.get(cacheKey);if(cached!==undefined)return cached;
 const value=normalize(source);if(!value)return source;
 const key=aliases.get(value);let translated:string;
 if(key)translated=t(key);
 else if(depth<6){
  const match=templates.map(template=>({template,match:template.regex.exec(value)})).find(x=>x.match);
  if(match){const values=Object.fromEntries(match.template.names.map((name,i)=>[name,localizeText(match.match![i+1],depth+1)]));translated=t(match.template.key,values);}
  else translated=language!=='ko'?value.replace(fragmentRegex,part=>t(fragmentKeys.get(part)!)):value;
 }else translated=value;
 if(language==='en')translated=translated.replace(/(?<![가-힣])나(?![가-힣])/g,'YOU');
 // Preserve spaces around text nodes in mixed markup (names, keyboard shortcuts, scores).
 const output=(source.match(/^\s*/)?.[0]??'')+translated+(source.match(/\s*$/)?.[0]??'');
 if(messageCache.size>1500)messageCache.clear();messageCache.set(cacheKey,output);return output;
}
