import * as THREE from 'three';
import type { Athlete } from './athlete.ts';
export type PlayerRole = 'you' | 'partner' | 'cpu';
export {PLAYER_LABELS} from './display-names.ts';
import {PLAYER_LABELS} from './display-names.ts';
export const ID_RING_INNER=.47,ID_RING_OUTER=.50;
export const parseNameplateSetting=(value:string|null):boolean=>value!=='off';
/** Constant CSS-pixel labels are readable at either end; projection never changes camera/actors. */
export function projectNameplate(anchor:THREE.Vector3,camera:THREE.Camera,width:number,height:number) {
  const p=anchor.clone().project(camera);
  return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,visible:p.z>=-1&&p.z<=1&&p.x>=-1&&p.x<=1&&p.y>=-1&&p.y<=1};
}
export interface IdentifiedAthlete {athlete:Athlete;role:PlayerRole;label?:string}
export class PlayerIdentification {
  readonly layer=document.createElement('div');
  readonly userRing=new THREE.Mesh(new THREE.RingGeometry(ID_RING_INNER,ID_RING_OUTER,64),new THREE.MeshBasicMaterial({color:0x23c778,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide}));
  private entries:{athlete:Athlete;element:HTMLSpanElement;headLift:number}[]=[];
  private enabled=true;
  constructor(canvas:HTMLCanvasElement,athletes:IdentifiedAthlete[],setting:HTMLInputElement) {
    this.layer.className='player-nameplates';this.layer.setAttribute('aria-hidden','true');canvas.after(this.layer);
    for(const {athlete,role,label:displayText} of athletes){
      const element=document.createElement('span'),label=PLAYER_LABELS[role];
      element.className=`player-nameplate role-${role}`;element.textContent=displayText??label.text;element.style.setProperty('--role-color',label.color);
      element.dataset.role=role;element.dataset.athlete=athlete.style;this.layer.append(element);
      athlete.group.updateWorldMatrix(true,true);
      const head=athlete.head.getWorldPosition(new THREE.Vector3()),bounds=new THREE.Box3().setFromObject(athlete.model,true);
      this.entries.push({athlete,element,headLift:Math.max(.18,bounds.max.y-head.y+.18)});
      if(role==='you'){this.userRing.name='human-player-identity-ring';this.userRing.rotation.x=-Math.PI/2;this.userRing.position.y=.013;athlete.group.add(this.userRing);}
    }
    try{this.enabled=parseNameplateSetting(localStorage.getItem('pickleball.nameplates'));}catch{/* Optional local preference. */}
    setting.checked=this.enabled;this.layer.hidden=!this.enabled;
    setting.addEventListener('change',()=>{
      this.enabled=setting.checked;this.layer.hidden=!this.enabled;
      try{localStorage.setItem('pickleball.nameplates',this.enabled?'on':'off');}catch{/* Keep working without storage. */}
      setting.blur();
    });
  }
  update(camera:THREE.Camera,canvas:HTMLCanvasElement,active:boolean) {
    this.layer.hidden=!this.enabled||!active;this.userRing.visible=active;
    if(this.layer.hidden)return;
    camera.updateWorldMatrix(true,false);
    const width=canvas.clientWidth,height=canvas.clientHeight;
    for(const {athlete,element,headLift} of this.entries){
      const anchor=athlete.head.getWorldPosition(new THREE.Vector3());anchor.y+=headLift;
      const p=projectNameplate(anchor,camera,width,height);element.hidden=!p.visible;
      element.style.transform=`translate(${canvas.offsetLeft+p.x}px,${canvas.offsetTop+p.y}px) translate(-50%,-100%)`;
    }
  }
}
