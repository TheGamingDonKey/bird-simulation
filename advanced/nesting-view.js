// Everything is built once; lifecycle updates only move or reveal existing parts.
export function createNestingView(THREE,scene,nesting){
 const root=new THREE.Group();root.name='Nests and nursery';scene.add(root);
 const standard=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.9,flatShading:true,...extra});
 const twigMaterial=standard(0x805a36),liningMaterial=standard(0xa38b5a,{side:THREE.DoubleSide}),gold=standard(0xd9ad4e),down=standard(0xf0cf78),dark=standard(0x78532d),wingMaterial=standard(0xba8f3f,{side:THREE.DoubleSide});
 const twigGeo=new THREE.CylinderGeometry(.045,.062,1,5),sphereGeo=new THREE.SphereGeometry(1,8,6),beakGeo=new THREE.ConeGeometry(.065,.18,4),legGeo=new THREE.CylinderGeometry(.025,.032,.13,4);
 const wingGeo=new THREE.BufferGeometry();wingGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.08,.5,0,-.15,.25,0,-.38,0,0,.08,.25,0,-.38,0,0,-.16],3));wingGeo.computeVertexNormals();
 const markerGeo=new THREE.TorusGeometry(1,.035,5,40),foodMarkerGeo=new THREE.TorusGeometry(.58,.024,5,32),seedGeo=new THREE.IcosahedronGeometry(.075,0),seedMaterial=standard(0xe0b95c);
 const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),tangent=new THREE.Vector3();
 const cold=new THREE.Color(0xd5ded3),warm=new THREE.Color(0xffedc4),nestViews=[],foodViews=[];
 function mesh(geometry,material,parent,name){const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=m.receiveShadow=!material.transparent;parent.add(m);return m;}
 function chick(parent,index){
  const bird=new THREE.Group();bird.name=`Nestling ${index+1}`;parent.add(bird);
  const body=mesh(sphereGeo,gold,bird,'Golden chick body');body.scale.set(.23,.27,.3);body.position.y=.26;
  const head=mesh(sphereGeo,down,bird,'Chick head');head.scale.set(.17,.18,.17);head.position.set(0,.56,.17);
  const beak=mesh(beakGeo,dark,head,'Begging beak');beak.position.set(0,-.05,.99);beak.scale.set(4.7,5.5,4.7);beak.rotation.x=Math.PI/2;
  const wings=[];for(const side of[-1,1]){const w=mesh(wingGeo,wingMaterial,bird,'Chick wing');w.position.set(side*.19,.28,0);w.scale.x=side;wings.push(w);}
  for(const side of[-1,1]){const leg=mesh(legGeo,dark,bird,'Chick foot');leg.position.set(side*.1,.065,.08);}
  return{bird,body,head,beak,wings};
 }
 for(let ni=0;ni<nesting.nests.length;ni++){
  const n=nesting.nests[ni],group=new THREE.Group();group.name=`Twig nest ${n.id}`;root.add(group);
  const lining=mesh(new THREE.SphereGeometry(1.05,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2),liningMaterial,group,'Woven nest lining');lining.scale.y=.22;lining.position.y=.1;
  const twigs=new THREE.InstancedMesh(twigGeo,twigMaterial,48);twigs.name='Interlaced nest twigs';twigs.castShadow=twigs.receiveShadow=true;group.add(twigs);
  for(let i=0;i<48;i++){
   const layer=Math.floor(i/12),a=i/12*Math.PI*2+layer*.31,r=.79+layer*.085;
   dummy.position.set(Math.cos(a)*r,-.075+layer*.078,Math.sin(a)*r);tangent.set(-Math.sin(a),Math.sin(i*1.7)*.15,Math.cos(a)).normalize();dummy.quaternion.setFromUnitVectors(up,tangent);dummy.scale.set(1,.52+(i%3)*.12,1);dummy.updateMatrix();twigs.setMatrixAt(i,dummy.matrix);
  }
  const marker=mesh(markerGeo,new THREE.MeshBasicMaterial({color:0x91c5cb,transparent:true,opacity:.8,depthWrite:false}),group,'Nest guidance halo');marker.rotation.x=Math.PI/2;marker.position.y=.13;marker.scale.setScalar(1.35);
  const slots=[];
  for(let i=0;i<Math.max(2,n.eggs.length);i++){
   const offsetX=(i%2?1:-1)*.31,offsetZ=Math.floor(i/2)*.32;
   const egg=mesh(sphereGeo,standard(0xffedc4),group,`Cream egg ${i+1}`);egg.scale.set(.22,.31,.22);egg.position.set(offsetX,.26,offsetZ);egg.rotation.z=(i%2?1:-1)*.14;
   const parts=chick(group,i);parts.bird.position.set(offsetX,-.03,offsetZ);slots.push({...parts,egg,offsetX,offsetZ,stage:'',eggId:null,enteredAt:0});
  }
  nestViews.push({root:group,marker,lining,twigs,slots,id:n.id});
 }
 for(let fi=0;fi<nesting.foodSources.length;fi++){
  const source=nesting.foodSources[fi],group=new THREE.Group();group.name=`Seed source ${source.id}`;root.add(group);
  const marker=mesh(foodMarkerGeo,new THREE.MeshBasicMaterial({color:0xc6e49a,transparent:true,opacity:.85,depthWrite:false}),group,'Food guidance halo');marker.rotation.x=Math.PI/2;marker.position.y=.04;
  const seeds=new THREE.InstancedMesh(seedGeo,seedMaterial,16);seeds.name='Small edible seed cluster';seeds.castShadow=seeds.receiveShadow=true;group.add(seeds);
  for(let i=0;i<16;i++){const a=i*2.39996,r=.05+Math.sqrt(i/16)*.29;dummy.position.set(Math.cos(a)*r,.018+(i%3)*.02,Math.sin(a)*r);dummy.rotation.set(i*.4,i*.7,i*.2);dummy.scale.set(.75,1.1,.75);dummy.updateMatrix();seeds.setMatrixAt(i,dummy.matrix);}
  foodViews.push({root:group,marker,seeds,available:true,id:source.id});
 }
 let lastTime=-Infinity;
 function update(state,player,active=false){
  const time=Number.isFinite(state.time)?state.time:0,rewound=time<lastTime;
  for(let ni=0;ni<nestViews.length;ni++){
   const view=nestViews[ni],n=state.nests[ni];view.root.visible=!!n;if(!n)continue;
   view.root.position.set(n.x,n.y+.15,n.z);view.marker.visible=!!active;
   const nearby=player&&Math.hypot(player.x-n.x,player.z-n.z)<12;
   view.marker.material.color.setHex(n.claimed?0xe8c76b:0x91c5cb);view.marker.material.opacity=nearby?.98:.75;view.marker.scale.setScalar(1.35+Math.sin(time*2+ni)*.025);
   for(let i=0;i<view.slots.length;i++){
    const slot=view.slots[i],e=n.eggs[i];slot.egg.visible=!!e&&e.stage==='egg';slot.bird.visible=!!e&&e.stage!=='egg';if(!e)continue;
    if(rewound||slot.stage!==e.stage||slot.eggId!==e.id){slot.enteredAt=time;slot.stage=e.stage;slot.eggId=e.id;}
    slot.egg.material.color.copy(cold).lerp(warm,Math.max(0,Math.min(1,(e.warmth||0)/12)));
    const hungry=Math.max(0,Math.min(1,e.hunger||0)),phase=time*(7+hungry*4)+i*2.1+ni;
    const fledged=e.stage==='fledged',elapsed=Math.max(0,time-slot.enteredAt),emerge=Math.min(1,elapsed/4);
    if(fledged){const angle=elapsed*1.3+i*Math.PI,r=.38+emerge*3.5;slot.bird.position.set(slot.offsetX+Math.cos(angle)*r*emerge,.08+emerge*(2.5+Math.sin(elapsed*1.8)*.32),slot.offsetZ+Math.sin(angle)*r*emerge);slot.bird.rotation.set(Math.sin(phase)*.025,-angle,Math.sin(elapsed)*.16);slot.bird.scale.setScalar(1.15+emerge*.25);}
    else{slot.bird.position.set(slot.offsetX,-.025+Math.sin(phase)*hungry*.025,slot.offsetZ);slot.bird.rotation.set(0,Math.sin(time*.7+i)*.24,0);slot.bird.scale.setScalar(.7+Math.min(1,(e.age||0)/24)*.3);}
    slot.head.rotation.x=fledged?0:-hungry*.22+Math.sin(phase)*hungry*.07;slot.beak.rotation.x=Math.PI/2+Math.max(0,Math.sin(phase))*hungry*.3;
    slot.wings.forEach((w,wi)=>{w.rotation.z=(wi?1:-1)*(fledged?Math.sin(phase)*.65:.2+Math.sin(phase)*(.05+hungry*.28));});
   }
  }
  for(let fi=0;fi<foodViews.length;fi++){
   const view=foodViews[fi],f=state.foodSources[fi];view.root.visible=!!f;if(!f)continue;
   view.root.position.set(f.x,f.y+.09,f.z);
   view.available=f.available!==false&&!(f.cooldown>0)&&!(f.readyAt>time);view.seeds.visible=view.available;view.marker.visible=!!active;
   view.marker.material.color.setHex(view.available?0xc6e49a:0x939487);view.marker.material.opacity=view.available?.85:.22;view.marker.scale.setScalar(1+Math.sin(time*2.6+fi)*.025);
  }
  lastTime=time;
 }
 update(nesting,null,false);
 return{root,nestViews,foodViews,update};
}
