import * as THREE from './vendor/three.module.min.js';
export function createBirdView(scene,max=700){
 const bodyGeo=new THREE.SphereGeometry(1,6,4), wingGeo=new THREE.BufferGeometry();
 wingGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.2,2.2,0,-.3,.7,0,-.9],3));wingGeo.computeVertexNormals();
 const mat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85,side:THREE.DoubleSide});
 const bodies=new THREE.InstancedMesh(bodyGeo,mat,max),left=new THREE.InstancedMesh(wingGeo,mat,max),right=new THREE.InstancedMesh(wingGeo,mat,max);
 for(const mesh of [bodies,left,right]){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;scene.add(mesh)}
 const colors=[new THREE.Color('#293738'),new THREE.Color('#e9dac0'),new THREE.Color('#98673c')];
 const root=new THREE.Object3D(),part=new THREE.Object3D(),matrix=new THREE.Matrix4();root.rotation.order='YXZ';
 const hawk=new THREE.Group();const hbody=new THREE.Mesh(bodyGeo,new THREE.MeshStandardMaterial({color:'#604431'}));hbody.scale.set(.6,.5,2);hawk.add(hbody);
 for(const side of [-1,1]){const w=new THREE.Mesh(wingGeo,new THREE.MeshStandardMaterial({color:'#72523c',side:THREE.DoubleSide}));w.scale.set(side*2,1,1.8);hawk.add(w)}scene.add(hawk);
 const lastHawk=new THREE.Vector3();let hadHawk=false;
 function update(habitat){
  for(const mesh of [bodies,left,right])mesh.count=habitat.birds.length;
  habitat.birds.forEach((b,i)=>{
   root.position.set(b.x,b.y,b.z);root.rotation.set(-Math.atan2(b.vy,Math.hypot(b.vx,b.vz)),Math.atan2(b.vx,b.vz),Math.sin(b.phase+habitat.time)*.13);root.updateMatrix();
   const size=[.65,.85,1.1][b.species];part.position.set(0,0,0);part.rotation.set(0,0,0);part.scale.set(.28*size,.23*size,.72*size);part.updateMatrix();matrix.multiplyMatrices(root.matrix,part.matrix);bodies.setMatrixAt(i,matrix);
   for(const [mesh,side] of [[left,-1],[right,1]]){part.scale.set(side*size,size,size);part.rotation.set(0,0,side*Math.sin(habitat.time*(b.species===2?5:9)+b.phase)*.65);part.updateMatrix();matrix.multiplyMatrices(root.matrix,part.matrix);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,colors[b.species])}
   bodies.setColorAt(i,colors[b.species]);
  });
  for(const mesh of [bodies,left,right]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true}
  hawk.visible=habitat.predator.active;hawk.position.set(habitat.predator.x,habitat.predator.y,habitat.predator.z);if(hadHawk&&hawk.position.distanceToSquared(lastHawk)>.000001){const heading=hawk.position.clone().sub(lastHawk);hawk.rotation.order='YXZ';hawk.rotation.set(-Math.atan2(heading.y,Math.hypot(heading.x,heading.z)),Math.atan2(heading.x,heading.z),0)}lastHawk.copy(hawk.position);hadHawk=hawk.visible;
 }
 return {update};
}
