import * as THREE from 'three';
import type { TimingState, PlayerHitContext } from './player-hit-assist.ts';
export const TIMING_COLORS = {idle:0xb6d8dc,soon:0xffd447,now:0x60f59a,blocked:0xf4a478};
/** Hollow timing cues, separate from shot effects; attached only to the human athlete. */
export class PlayerTimingVisual {
  readonly paddleCue = new THREE.Group();
  private face = new THREE.Mesh(new THREE.RingGeometry(.14,.17,32),new THREE.MeshBasicMaterial({transparent:true,opacity:.9,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));
  constructor(privateRing:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>) {
    this.ring=privateRing;
    privateRing.geometry.dispose();privateRing.geometry=new THREE.RingGeometry(1.31,1.38,64);
    privateRing.material.opacity=.9;privateRing.material.depthWrite=false;
    const edge=new THREE.Mesh(new THREE.RingGeometry(1.38,1.405,64),new THREE.MeshBasicMaterial({color:0x183f42,transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide}));
    edge.position.z=.001;privateRing.add(edge);
    const rim=new THREE.Mesh(new THREE.RingGeometry(.17,.195,32),new THREE.MeshBasicMaterial({color:0x163642,transparent:true,opacity:.8,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));
    this.face.renderOrder=91;rim.renderOrder=90;
    this.paddleCue.name='player-volley-timing';this.paddleCue.add(rim,this.face);this.paddleCue.visible=false;
  }
  private ring:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;
  update(state:TimingState,c:PlayerHitContext,paddle:THREE.Object3D,camera:THREE.PerspectiveCamera,paused:boolean,viewportHeight:number) {
    this.ring.visible=!paused&&c.role!=='none';this.ring.position.set(c.feet.x,.054,c.feet.z);
    this.ring.material.color.setHex(TIMING_COLORS[state]);this.ring.material.opacity=state==='idle'?.45:.95;
    this.paddleCue.visible=!paused&&c.role==='return'&&c.volleyAllowed&&!c.mustBounce&&c.ball.bounces===0&&(state==='soon'||state==='now');
    if(!this.paddleCue.visible)return;
    this.face.material.color.setHex(TIMING_COLORS[state]);
    paddle.updateWorldMatrix(true,false);this.paddleCue.position.copy(paddle.localToWorld(new THREE.Vector3(0,-.34,0)));
    this.paddleCue.quaternion.copy(camera.quaternion);
    const worldRadius=14*camera.position.distanceTo(this.paddleCue.position)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,viewportHeight);
    this.paddleCue.scale.setScalar(THREE.MathUtils.clamp(worldRadius/.17,.65,1.6));
  }
}
