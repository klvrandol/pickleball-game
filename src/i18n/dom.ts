import {LANGUAGES,getLanguage,localizeText,onLanguageChange,setLanguage,t,type Language} from './index.ts';
/** Binds existing UI text without touching rule messages, timers, actor IDs or scene objects. */
export function installI18n(root:HTMLElement=document.body){
 document.documentElement.lang=getLanguage();
 const sources=new WeakMap<Text,{source:string;output:string}>();
 const attributes=new WeakMap<Element,Map<string,{source:string;output:string}>>();
 const ignored=(node:Node)=>node.parentElement?.closest('script,style,[translate="no"]');
 function text(node:Text){
  if(ignored(node)||!node.data.trim())return;
  const old=sources.get(node);const source=old&&old.output===node.data?old.source:node.data;
  const output=localizeText(source);sources.set(node,{source,output});if(output!==node.data)node.data=output;
 }
 function element(el:Element){
  for(const name of ['aria-label','title']){const value=el.getAttribute(name);if(!value)continue;
   let map=attributes.get(el);if(!map){map=new Map();attributes.set(el,map);}const old=map.get(name),source=old?.output===value?old.source:value,output=localizeText(source);map.set(name,{source,output});if(output!==value)el.setAttribute(name,output);
  }
 }
 function scan(node:Node){
  if(node.nodeType===Node.TEXT_NODE){text(node as Text);return;}
  if(node instanceof Element)element(node);
  const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
  while(walker.nextNode()){const item=walker.currentNode;if(item instanceof Text)text(item);else if(item instanceof Element)element(item);}
 }
 const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')text(record.target as Text);else if(record.type==='attributes')element(record.target as Element);else for(const node of record.addedNodes)scan(node);}});
 observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title']});
 const sync=()=>{scan(root);document.title=localizeText(document.title);root.querySelectorAll<HTMLSelectElement>('[data-language-select]').forEach(select=>select.value=getLanguage());};
 const unsubscribe=onLanguageChange(sync);sync();
 return ()=>{observer.disconnect();unsubscribe();};
}
export function languageControl():HTMLLabelElement {
 const label=document.createElement('label');label.className='setting-row language-setting';
 const caption=document.createElement('span');caption.textContent=t('language.label');label.append(caption);
 const select=document.createElement('select');select.dataset.languageSelect='';
 for(const [value,{label:text}]of Object.entries(LANGUAGES)){const option=new Option(text,value);option.setAttribute('translate','no');select.add(option);}
 select.value=getLanguage();select.addEventListener('change',()=>setLanguage(select.value as Language));label.append(select);
 const unsubscribe=onLanguageChange(()=>{if(!label.isConnected){unsubscribe();return;}caption.textContent=t('language.label');select.value=getLanguage();});return label;
}
