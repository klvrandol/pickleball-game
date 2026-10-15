import * as THREE from 'three';
/** A hollow billboard remains visible through avatars; it never changes ball physics. */
export function createBallLocator(radius: number) {
  const group=new THREE.Group();group.name='ball-location-overlay';
  for(const [inner,outer,color,order] of [[1.24,1.55,0x132b42,100],[1.30,1.46,0xfff88a,101]]) {
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius*inner,radius*outer,40),new THREE.MeshBasicMaterial({
      color,side:THREE.DoubleSide,depthTest:false,depthWrite:false,transparent:true,opacity:.95,
    }));
    ring.renderOrder=order;group.add(ring);
  }
  return group;
}
