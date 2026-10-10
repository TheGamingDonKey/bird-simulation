import {wingGeometry,tailGeometry} from './bird-view.js';
import {terrainHeight} from './terrain.js';

export function createPlayerView(THREE,scene){
 const root=new THREE.Group();root.name='Your bird';root.rotation.order='YXZ';scene.add(root);
 const feather=new THREE.MeshStandardMaterial({color:'#e8be62',roughness:.7,side:THREE.DoubleSide,flatShading:true});
 const dark=new THREE.MeshStandardMaterial({color:'#583d26',roughness:.8,flatShading:true});
 const body=new THREE.Mesh(new THREE.SphereGeometry(1,10,7),feather);body.scale.set(.38,.31,.97);root.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.32,8,6),feather);head.position.set(0,.18,.75);root.add(head);
 const beak=new THREE.Mesh(new THREE.ConeGeometry(.12,.38,4),dark);beak.rotation.x=Math.PI/2;beak.position.set(0,.16,1.10);root.add(beak);
 const wings=[];for(const side of [-1,1]){const wing=new THREE.Mesh(wingGeometry(),feather);wing.position.set(side*.16,.06,0);wing.scale.set(side*1.1,1,1.05);root.add(wing);wings.push(wing);}
 const tail=new THREE.Mesh(tailGeometry(),dark);tail.scale.set(1.05,1,1.15);root.add(tail);
 for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.34,5),dark);leg.position.set(side*.14,-.29,.1);root.add(leg);}
 root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
 const targetMarker=new THREE.Mesh(new THREE.TorusGeometry(1.25,.065,5,32),new THREE.MeshBasicMaterial({color:'#e9da83',transparent:true,opacity:.9,depthWrite:false}));targetMarker.rotation.x=Math.PI/2;targetMarker.name='Nearest landing perch';scene.add(targetMarker);
 const direction=new THREE.Vector3(),destination=new THREE.Vector3(),look=new THREE.Vector3();let current;
 function update(player,active,nearest){
  current=player;root.visible=active;targetMarker.visible=active&&!!nearest;root.position.set(player.x,player.y,player.z);
  root.rotation.set(-player.pitch,player.yaw+Math.PI,player.turn*.38);
  const perched=player.mode==='perched',gliding=player.flightState==='glide'||player.mode==='landing';
  const flap=perched?-.3:gliding?.06:Math.sin(player.phase)*(.4+player.energy*.2);
  wings.forEach((wing,i)=>{wing.rotation.z=(i===0?-1:1)*flap;wing.scale.set((i===0?-1:1)*(perched?.17:1.1),1,perched?1.7:1.05);});
  if(nearest){const p=nearest.perch;targetMarker.position.set(p.x,p.y+.12,p.z);targetMarker.material.color.set(nearest.horizontalDistance<=24&&Math.abs(player.y-p.y-.4)<=18?'#b7edb0':'#e9bf73');targetMarker.scale.setScalar(1+Math.sin((player.time||0)*3)*.05);}
 }
 function updateCamera(camera,controls,dt,instant=false){
  const p=current;if(!p)return;direction.set(-Math.sin(p.yaw),Math.sin(p.pitch)*.25,-Math.cos(p.yaw)).normalize();
  if(p.mode==='perched'){destination.set(p.x+8,p.y+5,p.z+10);look.set(p.x,p.y+.5,p.z);}
  else{destination.set(p.x,p.y+3.8,p.z).addScaledVector(direction,-12);look.set(p.x,p.y+.7,p.z).addScaledVector(direction,7);}
  destination.y=Math.max(destination.y,Math.max(terrainHeight(destination.x,destination.z),-2.5)+2);
  if(instant)camera.position.copy(destination);else camera.position.lerp(destination,1-Math.exp(-Math.min(dt,.1)*5));
  camera.position.y=Math.max(camera.position.y,Math.max(terrainHeight(camera.position.x,camera.position.z),-2.5)+1.5);
  camera.up.set(0,1,0);camera.lookAt(look);controls.target.copy(look);
 }
 root.visible=targetMarker.visible=false;return {root,wings,targetMarker,update,updateCamera};
}
