import './title-screen.css';
import {TITLE_COPY as copy} from './title-copy.ts';
import {createTitleScene} from './title-scene.ts';
import {loadDoublesModels} from './athlete-model.ts';
import {createAthlete,animateAthlete} from './athlete.ts';
import {GameAudio} from './audio.ts';
import {parseGameSpeed} from './speed.ts';
const root=document.querySelector<HTMLElement>('#title-root')!;
root.innerHTML=`<section class="menu-shell"><span class="kicker">${copy.eyebrow}</span><h1>${copy.title}</h1><p class="subtitle">${copy.subtitle}</p><nav aria-label="메인 메뉴"><a id="start-doubles" class="menu-button primary" href="./doubles.html?play=1" aria-disabled="true"><small>${copy.featured}</small><strong>${copy.doubles} <span>↗</span></strong><em>${copy.doublesHint}</em></a><a id="start-singles" class="menu-button secondary" href="./singles.html?play=1" aria-disabled="true"><strong>${copy.singles} <span>→</span></strong><em>${copy.singlesHint}</em></a><button id="open-settings" class="menu-button">${copy.settings}<span>⚙</span></button><button id="open-help" class="menu-button">${copy.help}<span>?</span></button></nav><p id="load-status" role="status">${copy.loading}</p></section><footer>${copy.footer}</footer><dialog id="menu-dialog" aria-labelledby="panel-title"><h2 id="panel-title"></h2><div id="panel-content"></div><button id="close-panel" class="panel-close">${copy.close} <span>←</span></button></dialog>`;
const dialog=document.querySelector<HTMLDialogElement>('#menu-dialog')!,content=document.querySelector<HTMLElement>('#panel-content')!;
const audio=new GameAudio();
function read(key:string){try{return localStorage.getItem(key);}catch{return null;}}
function save(key:string,value:string){try{localStorage.setItem(key,value);}catch{}}
function openPanel(title:string){document.querySelector('#panel-title')!.textContent=title;dialog.showModal();}
document.querySelector('#open-help')!.addEventListener('click',()=>{content.innerHTML=`<dl>${copy.controls.map(([key,description])=>`<div><dt>${key}</dt><dd>${description}</dd></div>`).join('')}</dl><div class="tips">${copy.tips.map(t=>`<p>${t}</p>`).join('')}</div>`;openPanel(copy.help);});
document.querySelector('#open-settings')!.addEventListener('click',()=>{
 content.innerHTML=`<label class="setting-row">${copy.speed}<select id="menu-speed">${copy.speeds.map(([v,label])=>`<option value="${v}">${label}</option>`).join('')}</select></label><label class="setting-row">${copy.sound}<input id="menu-sound" type="checkbox"/></label><label class="setting-row">${copy.volume}<input id="menu-volume" type="range" min="0" max="100"/></label><label class="setting-row">${copy.names}<input id="menu-names" type="checkbox"/></label><label class="setting-row">${copy.motion}<input id="menu-motion" type="checkbox"/></label><p class="setting-note">${copy.saved}</p>`;
 const speed=content.querySelector<HTMLSelectElement>('#menu-speed')!;speed.value=String(parseGameSpeed(read('pickleball.speed')));speed.onchange=()=>save('pickleball.speed',speed.value);
 const sound=content.querySelector<HTMLInputElement>('#menu-sound')!;sound.checked=audio.enabled;sound.onchange=()=>audio.setEnabled(sound.checked);
 const volume=content.querySelector<HTMLInputElement>('#menu-volume')!;volume.value=String(audio.volume*100);volume.oninput=()=>audio.setVolume(Number(volume.value)/100);
 const names=content.querySelector<HTMLInputElement>('#menu-names')!;names.checked=read('pickleball.nameplates')!=='off';names.onchange=()=>save('pickleball.nameplates',names.checked?'on':'off');
 const motion=content.querySelector<HTMLInputElement>('#menu-motion')!;motion.checked=read('pickleball.reduceMotion')===null?matchMedia('(prefers-reduced-motion: reduce)').matches:read('pickleball.reduceMotion')==='on';motion.onchange=()=>save('pickleball.reduceMotion',motion.checked?'on':'off');
 openPanel(copy.settings);
});
document.querySelector('#close-panel')!.addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
for(const link of root.querySelectorAll<HTMLAnchorElement>('nav a'))link.addEventListener('click',e=>{if(link.getAttribute('aria-disabled')==='true')e.preventDefault();});
async function boot(){
 const canvas=document.querySelector<HTMLCanvasElement>('#title-court')!;
 const {renderer,scene,camera}=createTitleScene(canvas);
 camera.position.set(11,12,16);camera.lookAt(0,0,0);
 function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
 resize();window.addEventListener('resize',resize);renderer.render(scene,camera);
 await loadDoublesModels();
 const styles=['ranger','rogue','barbarian','mage'] as const;
 const actors=styles.map((style,i)=>{const actor=createAthlete(i<2?'player':'cpu',i<2?3.9:-3.9,i<2?0:Math.PI,style);actor.group.position.x=i%2?1.65:-1.65;scene.add(actor.group);return actor;});
 root.dataset.ready='true';for(const link of root.querySelectorAll('nav a'))link.removeAttribute('aria-disabled');document.querySelector('#load-status')!.textContent=copy.ready;
 let previous=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min((now-previous)/1000,.05);previous=now;actors.forEach((actor,i)=>animateAthlete(actor,{walking:false,phase:0,swingLeft:0,shot:'drive',lateral:0,side:1,ready:true,dt,time:now/1000+i*.4,reduceMotion:read('pickleball.reduceMotion')==='on'}));renderer.render(scene,camera);});
}
boot().catch(error=>{document.querySelector('#load-status')!.textContent=copy.error;document.querySelector('#load-status')!.setAttribute('role','alert');console.error(error);});
