import * as THREE from './vendor/three.module.min.js';
// Ridged feather outlines and forked tails remain readable at observation distance.
export function wingGeometry(){
 const outline=[[0,0,.28],[.72,.04,.35],[1.55,0,.23],[2.27,-.03,.02],[2.35,-.03,-.28],[1.98,-.03,-.3],[2.1,-.04,-.55],[1.62,-.04,-.5],[1.64,-.04,-.77],[1.13,-.02,-.62],[.64,0,-.61],[0,0,-.28]],positions=[];
 for(let i=0;i<outline.length;i++)positions.push(.8,.09,-.12,...outline[i],...outline[(i+1)%outline.length]);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
export function tailGeometry(){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.18,0,-.48,-.53,0,-1.52,0,.035,-1.12,-.18,0,-.48,0,.035,-1.12,.18,0,-.48,.18,0,-.48,0,.035,-1.12,.53,0,-1.52],3));g.computeVertexNormals();return g;
}
export function createBirdView(scene,max=700){
 const bodyGeo=new THREE.SphereGeometry(1,7,5),wingGeo=wingGeometry(),tailGeo=tailGeometry();
 const beakGeo=new THREE.ConeGeometry(.13,.43,4);beakGeo.rotateX(Math.PI/2);
 const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85,side:THREE.DoubleSide,flatShading:true});
 const bodies=new THREE.InstancedMesh(bodyGeo,mat,max),left=new THREE.InstancedMesh(wingGeo,mat,max),right=new THREE.InstancedMesh(wingGeo,mat,max);
 const tails=new THREE.InstancedMesh(tailGeo,mat,max),beaks=new THREE.InstancedMesh(beakGeo,new THREE.MeshStandardMaterial({color:0xc6a473,roughness:1}),max);
 const batches=[bodies,left,right,tails,beaks],wings=[[left,-1],[right,1]];
 ['Bird bodies','Left feathered wings','Right feathered wings','Forked tails','Bird beaks'].forEach((name,i)=>batches[i].name=name);
 for(const mesh of batches){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);}
 const colors=[new THREE.Color('#293738'),new THREE.Color('#e9dac0'),new THREE.Color('#98673c')];
 const sizes=[.65,.85,1.1],spans=[1,1.1,1.32],chords=[.68,.94,1.13],tailLengths=[1.04,.78,.86];
 const root=new THREE.Object3D(),part=new THREE.Object3D(),matrix=new THREE.Matrix4();root.rotation.order='YXZ';
 function place(mesh,index){part.updateMatrix();matrix.multiplyMatrices(root.matrix,part.matrix);mesh.setMatrixAt(index,matrix);}
 const hawk=new THREE.Group();hawk.name='Pursuing hawk';hawk.rotation.order='YXZ';
 const hawkMat=new THREE.MeshStandardMaterial({color:'#604431',roughness:.9,side:THREE.DoubleSide,flatShading:true});
 const hbody=new THREE.Mesh(bodyGeo,hawkMat);hbody.scale.set(.6,.45,1.75);hawk.add(hbody);
 for(const side of [-1,1]){const w=new THREE.Mesh(wingGeo,hawkMat);w.scale.set(side*1.85,1,1.65);w.rotation.z=side*.08;hawk.add(w);}
 const htail=new THREE.Mesh(tailGeo,hawkMat);htail.scale.set(1.8,1,1.4);hawk.add(htail);
 const hbeak=new THREE.Mesh(beakGeo,new THREE.MeshStandardMaterial({color:0xbd9250}));hbeak.position.z=1.84;hbeak.scale.setScalar(1.8);hawk.add(hbeak);
 hawk.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});scene.add(hawk);
 const lastHawk=new THREE.Vector3(),heading=new THREE.Vector3();let hadHawk=false;
 function update(habitat){
  const count=Math.min(max,habitat.birds.length);for(const mesh of batches)mesh.count=count;
  for(let i=0;i<count;i++){
   const b=habitat.birds[i],species=b.species,size=sizes[species],color=colors[species];
   // YXZ applies roll about the forward axis, including while climbing.
   const bank=Math.max(-.55,Math.min(.55,b.turn??Math.sin(b.phase+habitat.time)*.06));
   root.position.set(b.x,b.y,b.z);root.rotation.set(-Math.atan2(b.vy,Math.hypot(b.vx,b.vz)),Math.atan2(b.vx,b.vz),bank);root.updateMatrix();
   part.position.set(0,0,0);part.rotation.set(0,0,0);part.scale.set(.29*size,.24*size,.78*size);place(bodies,i);bodies.setColorAt(i,color);
   const glide=b.flightState==='glide',energy=Math.max(0,Math.min(1,b.energy??.8));
   const phase=b.flightState?b.phase:habitat.time*(species===2?5:9)+b.phase;
   const flap=glide?.08+Math.sin((b.flightClock??0)*.7)*.015:Math.sin(phase)*(.43+energy*.26);
   for(const [mesh,side] of wings){part.position.set(side*.12*size,.03*size,0);part.scale.set(side*size*spans[species],size,size*chords[species]);part.rotation.set(0,0,side*flap);place(mesh,i);mesh.setColorAt(i,color);}
   part.position.set(0,0,0);part.rotation.set(glide?-.035:Math.sin(phase)*.045,0,0);part.scale.set(size*(species===2?1.18:.9),size,size*tailLengths[species]);place(tails,i);tails.setColorAt(i,color);
   part.position.set(0,.025*size,.86*size);part.rotation.set(0,0,0);part.scale.set(size,size,size*(species===1?1.45:1));place(beaks,i);
  }
  for(const mesh of batches){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  hawk.visible=habitat.predator.active;hawk.position.set(habitat.predator.x,habitat.predator.y,habitat.predator.z);
  if(hadHawk&&hawk.position.distanceToSquared(lastHawk)>.000001){heading.copy(hawk.position).sub(lastHawk);hawk.rotation.set(-Math.atan2(heading.y,Math.hypot(heading.x,heading.z)),Math.atan2(heading.x,heading.z),0);}
  lastHawk.copy(hawk.position);hadHawk=hawk.visible;
 }
 return {update};
}
