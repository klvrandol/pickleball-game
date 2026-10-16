import {t,onLanguageChange,getLanguage} from './i18n/index.ts';
/** Presentation names only: asset URLs, actor IDs, team membership and rules keep their IDs. */
export const PLAYER_LABELS={you:{get text(){return t('name.you');},color:'#146b43'},partner:{get text(){return t('name.partner');},color:'#185fa8'},cpu:{text:'CPU',color:'#ae293d'}} as const;
export const SINGLES_NAMES={get player(){return PLAYER_LABELS.you.text;},cpu:PLAYER_LABELS.cpu.text} as const;
export const DOUBLES_NAMES={get ranger(){return PLAYER_LABELS.you.text;},get rogue(){return PLAYER_LABELS.partner.text;},barbarian:'CPU 1',mage:'CPU 2'} as const;
export type DisplayActor=keyof typeof DOUBLES_NAMES;
export function displayName(mode:'singles'|'doubles',actor:DisplayActor):string {
  return mode==='doubles'?DOUBLES_NAMES[actor]:actor==='ranger'?SINGLES_NAMES.player:actor==='rogue'?PLAYER_LABELS.partner.text:SINGLES_NAMES.cpu;
}
export function displayColor(actor:DisplayActor):string{return actor==='ranger'?PLAYER_LABELS.you.color:actor==='rogue'?PLAYER_LABELS.partner.color:PLAYER_LABELS.cpu.color;}
export function applyDisplayNames(root:ParentNode,mode:'singles'|'doubles'){
  onLanguageChange(()=>update());
  function update(){
  root.querySelectorAll<HTMLElement>('[data-display-name]').forEach(element=>{
    const actor=element.dataset.displayName as DisplayActor;
    element.textContent=displayName(mode,actor);element.style.color=displayColor(actor);
  });
  }update();
}
/** Keep the roster's role colors without rebuilding its DOM every animation frame. */
export function renderDoublesRoster(element:HTMLElement){
  if(element.dataset.roster===getLanguage())return;
  const nodes:(Node|string)[]=['우리 팀: '];
  for(const [index,actor] of (Object.keys(DOUBLES_NAMES) as DisplayActor[]).entries()){
    if(index>0)nodes.push(index===2?' · 상대 팀: ':' + ');
    const name=document.createElement('span');name.textContent=DOUBLES_NAMES[actor];name.style.color=displayColor(actor);nodes.push(name);
  }
  element.replaceChildren(...nodes);element.dataset.roster=getLanguage();
}
