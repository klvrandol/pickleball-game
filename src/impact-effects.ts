import * as THREE from 'three';
export type ImpactKind='drive'|'dink'|'volley';
export const IMPACT_DURATION:Record<ImpactKind,number>={drive:.16,dink:.23,volley:.12};
const COLORS:Record<ImpactKind,number>={drive:0xc7efff,dink:0xb9ef92,volley:0xffe25c};
/** Four reusable, hollow effects; no particles, camera shake, or physics references. */
export class ImpactEffects {
  readonly root=new THREE.Group();
  private next=0;
  private slots=Array.from({length:4},()=>{
    const anchor=new THREE.Group(),billboard=new THREE.Group();anchor.add(billboard);this.root.add(anchor);anchor.visible=false;
    const material=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
    const ring=new THREE.Mesh(new THREE.RingGeometry(.18,.20,32),material);billboard.add(ring);
    const points:number[]=[];
    for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;for(const r of [.25,.39])points.push(Math.cos(a)*r,Math.sin(a)*r,0);}
    const rays=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3)),new THREE.LineBasicMaterial({transparent:true,depthWrite:false}));billboard.add(rays);
    const tail=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,0,0,0,0,0,0,0,0],3)),new THREE.LineBasicMaterial({color:0xc7efff,transparent:true,depthWrite:false}));anchor.add(tail);
    return{anchor,billboard,ring,rays,tail,kind:'drive' as ImpactKind,age:1,fresh:false,direction:new THREE.Vector3()};
  });
  constructor(){this.root.name='shot-impact-effects';}
  emit(kind:ImpactKind,position:THREE.Vector3,velocity:THREE.Vector3){
    const slot=this.slots[this.next++%this.slots.length];slot.kind=kind;slot.age=0;slot.fresh=true;
    slot.anchor.position.copy(position);slot.anchor.visible=true;slot.anchor.userData.kind=kind;
    slot.direction.copy(velocity).normalize();slot.ring.material.color.setHex(COLORS[kind]);slot.rays.material.color.setHex(COLORS[kind]);
  }
  clear(){for(const slot of this.slots){slot.age=1;slot.fresh=false;slot.anchor.visible=false;}}
  update(dt:number,camera:THREE.Camera,reduceMotion=false){
    for(const s of this.slots){
      if(s.fresh)s.fresh=false;else s.age+=Math.max(0,dt);const t=s.age/IMPACT_DURATION[s.kind];s.anchor.visible=t<1&&!reduceMotion;
      if(!s.anchor.visible)continue;
      const fade=(1-t)*(1-t);s.billboard.quaternion.copy(camera.quaternion);
      s.ring.visible=s.kind!=='volley';s.rays.visible=s.kind!=='dink';s.tail.visible=s.kind==='drive';
      s.ring.scale.setScalar(s.kind==='dink'?1+t*1.4:1+t*.65);s.ring.material.opacity=fade*(s.kind==='dink'?.55:.65);
      s.rays.scale.setScalar(1+t*.5);s.rays.material.opacity=fade*.75;s.tail.material.opacity=fade*.50;
      const data=s.tail.geometry.getAttribute('position') as THREE.BufferAttribute;
      // Two tiny speed strokes behind the stationary contact origin, outside the ball's center.
      for(let i=0;i<4;i++){const distance=(i%2===0?.17:.34)+Math.floor(i/2)*.06+t*.10;const p=s.direction.clone().multiplyScalar(-distance);p.x+=Math.floor(i/2)*.045;data.setXYZ(i,p.x,p.y,p.z);}
      data.needsUpdate=true;
    }
  }
}
