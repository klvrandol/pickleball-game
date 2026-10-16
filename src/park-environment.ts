import * as THREE from 'three';
/** Decorative park only. No gameplay, colliders, lights, camera, or random state. */
export function createParkEnvironment(){
  const root=new THREE.Group();root.name='park-environment';
  const materials=new Map<number,THREE.MeshStandardMaterial>();
  const material=(color:number)=>{let m=materials.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.92});materials.set(color,m);}return m;};
  const cube=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,8),crown=new THREE.IcosahedronGeometry(1,1);
  function section(name:string){const g=new THREE.Group();g.name=name;root.add(g);return g;}
  function box(g:THREE.Group,w:number,h:number,d:number,color:number,x:number,y:number,z:number,shadow=true){
    const m=new THREE.Mesh(cube,material(color));m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;g.add(m);return m;
  }
  function round(g:THREE.Group,r:number,h:number,color:number,x:number,y:number,z:number){const m=new THREE.Mesh(cylinder,material(color));m.scale.set(r,h,r);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
  const ground=section('park-ground');
  box(ground,180,.15,180,0xb2c69e,0,-.19,0,false);
  // Preserve the existing 13 x 23 m run-out platform and its surface height.
  box(ground,13,.12,23,0x82a99b,0,-.07,0,false);
  const paths=section('park-paths');
  for(const x of [-8,8])box(paths,2.15,.045,26,0xd2c9b6,x,-.085,-1,false);
  box(paths,18.15,.045,2,0xd2c9b6,0,-.085,-13,false);
  // Fine paving joints stay outside the sports surface.
  const paving:number[]=[];
  for(const x of [-8,8])for(let z=-13;z<=11;z+=2)paving.push(x-1.02,-.06,z,x+1.02,-.06,z);
  const seams=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(paving,3)),new THREE.LineBasicMaterial({color:0xb8b4a5,transparent:true,opacity:.45}));paths.add(seams);
  const fences=section('park-fences');const wire:number[]=[];
  const posts:THREE.Vector3[]=[];
  // Side fences and a rear gate; the foreground is deliberately open for the camera.
  for(const x of [-6.7,6.7]){
    for(let z=-10.2;z<=9.81;z+=2)posts.push(new THREE.Vector3(x,.40,z));
    box(fences,.055,.055,20,0x55786a,x,.83,-.2,false);
    for(const y of [.18,.40,.62,.80])wire.push(x,y,-10.2,x,y,9.8);
    for(let z=-10.2;z<=9.8;z+=.33)wire.push(x,.12,z,x,.80,z);
  }
  for(const [a,b]of [[-6.7,-1.15],[1.15,6.7]]){
    for(let x=a;x<b;x+=1.85)posts.push(new THREE.Vector3(x,.40,-10.2));posts.push(new THREE.Vector3(b,.40,-10.2));
    box(fences,b-a,.055,.055,0x55786a,(a+b)/2,.83,-10.2,false);
    for(const y of [.18,.40,.62,.80])wire.push(a,y,-10.2,b,y,-10.2);
    for(let x=a;x<=b;x+=.33)wire.push(x,.12,-10.2,x,.80,-10.2);
  }
  const postMesh=new THREE.InstancedMesh(cylinder,material(0x45685b),posts.length),matrix=new THREE.Matrix4();
  posts.forEach((p,i)=>{matrix.compose(p,new THREE.Quaternion(),new THREE.Vector3(.045,.92,.045));postMesh.setMatrixAt(i,matrix);});postMesh.name='low-fence-posts';fences.add(postMesh);
  const meshWire=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(wire,3)),new THREE.LineBasicMaterial({color:0x527669,transparent:true,opacity:.27}));fences.add(meshWire);
  const benches=section('park-benches');
  function bench(x:number,z:number,rotation:number){
    const g=new THREE.Group();g.name='slatted-bench';g.position.set(x,0,z);g.rotation.y=rotation;benches.add(g);
    for(const dz of [-.18,0,.18])box(g,1.85,.075,.15,0xb48c61,0,.44,dz);
    for(const y of [.68,.88])box(g,1.85,.13,.065,0xb48c61,0,y,.25);
    for(const dx of [-.67,.67]){
      box(g,.08,.84,.08,0x496858,dx,.38,.25);box(g,.08,.40,.08,0x496858,dx,.14,-.19);
      box(g,.11,.08,.53,0x496858,dx,.33,.02);
    }
  }
  bench(-8,-3,-Math.PI/2);bench(8,-5,Math.PI/2);
  const trees=section('park-trees');
  const treeLayout=[[-11,-10,1],[-11.3,-1,.92],[-11.6,7,1.02],[11.3,-8,1.08],[11.5,3,.96],[12,10,.92],[-9,-16,1.1],[-3,-16.5,.96],[4.8,-16,1.12],[11,-16.5,1]];
  for(const [x,z,s]of treeLayout){
    const g=new THREE.Group();g.name='park-tree';g.position.set(x,-.10,z);g.scale.setScalar(s);trees.add(g);
    round(g,.14,2.2,0x89765a,0,1.03,0);
    for(const [dx,y,dz,r,color]of [[-.43,2.5,.12,1.04,0x7c9d76],[.43,2.7,-.1,1,0x6f946c],[0,3.25,0,.95,0x8aab7e]]){
      const m=new THREE.Mesh(crown,material(color));m.position.set(dx,y,dz);m.scale.set(r,r*.88,r);m.castShadow=true;m.receiveShadow=true;g.add(m);
    }
    round(g,.72,.025,0x8caa7b,0,.005,0);
  }
  const planting=section('park-planting');
  for(const [x,z]of [[-10,-6],[-10,3],[10,-2],[10,7],[-5,-14.5],[7,-14.5]]){
    box(planting,1.45,.24,.8,0xa5967c,x,.015,z);
    for(const dx of [-.42,0,.42]){const m=new THREE.Mesh(crown,material(dx===0?0x799878:0x8fa983));m.scale.set(.38,.32,.36);m.position.set(x+dx,.35,z);m.castShadow=true;planting.add(m);}
  }
  const objects=section('park-objects');
  // Compact bins and drinking fountain beside the seating areas.
  for(const [x,z]of [[-8.5,-5],[8.5,-7]]){
    round(objects,.22,.61,0x607e72,x,.20,z);round(objects,.25,.08,0x3e5e54,x,.54,z);
    box(objects,.24,.06,.14,0x294c43,x,.59,z,false);
  }
  round(objects,.11,.78,0xa2b1ae,8.5,.28,-2.5);round(objects,.23,.09,0x839c98,8.5,.70,-2.5);
  box(objects,.06,.13,.06,0x5c7b75,8.5,.79,-2.5);
  // Daytime path lamps: matte props, no added light sources or flashing.
  for(const [x,z]of [[-9.5,-8],[9.5,0]]){
    round(objects,.055,2.7,0x4d685e,x,1.25,z);
    box(objects,.30,.24,.30,0xe4e3cf,x,2.61,z);box(objects,.40,.07,.40,0x4d685e,x,2.77,z);
  }
  // Small entrance plaque with a paddle symbol, well behind the far baseline.
  box(objects,1.5,.55,.10,0x507867,0,1.03,-13.2);
  for(const x of [-.60,.60])box(objects,.08,1.1,.08,0x786c55,x,.40,-13.2);
  const plaque=box(objects,.25,.28,.018,0xd8e7d9,0,1.08,-13.14,false);plaque.rotation.z=-.35;
  box(objects,.055,.19,.02,0xd8e7d9,.06,.87,-13.13,false);
  return root;
}
