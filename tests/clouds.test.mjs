import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../advanced/vendor/three.module.min.js';
import {createWorld} from '../advanced/world.js';

function setup() {
  const previous = globalThis.document;
  globalThis.document = {createElement:()=>({getContext:()=>({fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},createRadialGradient(){return {addColorStop(){}};}})})};
  let world;
  try { world=createWorld(THREE,new THREE.Scene()); } finally { globalThis.document=previous; }
  const clouds=world.root.children.find(o=>o.isInstancedMesh&&o.geometry.type==='IcosahedronGeometry'&&o.count===48);
  assert.ok(clouds);
  return {world,clouds};
}
function positions(clouds) {
  return Array.from({length:clouds.count},(_,i)=>{
    const matrix=new THREE.Matrix4();clouds.getMatrixAt(i,matrix);
    return new THREE.Vector3().setFromMatrixPosition(matrix);
  });
}

test('a late gust changes cloud velocity without recalculating their past travel',()=>{
  const {world,clouds}=setup();
  world.update(.04,1200,{wind:{x:3,z:1}});
  const before=positions(clouds);
  world.update(.04,1200.04,{wind:{x:-7,z:4}});
  const after=positions(clouds);
  for(let i=0;i<before.length;i++){
    assert.ok(after[i].distanceTo(before[i])<.06,`Cloud ${i} jumped ${after[i].distanceTo(before[i]).toFixed(2)} units in 40ms`);
    assert.ok(Math.abs(after[i].x-before[i].x-(-7*.12*.04))<.0001);
  }
});

test('cloud drift depends on timestep, pauses, and resets to its original placement',()=>{
  const a=setup(),b=setup(),initial=positions(a.clouds);
  a.world.update(.1,900,{wind:{x:2,z:3}});
  b.world.update(.05,899.95,{wind:{x:2,z:3}});b.world.update(.05,900,{wind:{x:2,z:3}});
  const actual=positions(a.clouds),split=positions(b.clouds);
  actual.forEach((p,i)=>assert.ok(p.distanceTo(split[i])<.0001));
  for(const dt of [0,-1,Infinity,NaN])a.world.update(dt,2000,{wind:20});
  assert.deepEqual(positions(a.clouds),actual);
  a.world.reset();assert.deepEqual(positions(a.clouds),initial);
});

test('whole cloud banks recycle only while faded out and cannot disappear from stale culling bounds',()=>{
  const {world,clouds}=setup();
  const fade=clouds.geometry.getAttribute('cloudFade');assert.ok(fade,'Clouds need individual bank opacity');
  assert.equal(clouds.frustumCulled,false);
  let before=positions(clouds),previousFade=Array.from(fade.array),wraps=0;
  for(let frame=1;frame<=180;frame++){
    world.update(.1,frame*.1,{wind:{x:1000,z:1000}});
    const after=positions(clouds);
    for(let bank=0;bank<12;bank++){
      const i=bank*4;
      if(after[i].distanceTo(before[i])>100){
        wraps++;assert.equal(previousFade[i],0);assert.equal(fade.getX(i),0);
      }
      for(let j=1;j<4;j++){
        assert.equal(fade.getX(i+j),fade.getX(i));
        assert.ok(Math.abs((after[i+j].x-after[i].x)-(before[i+j].x-before[i].x))<.0001,'One bank must not split across the sky');
      }
    }
    before=after;previousFade=Array.from(fade.array);
  }
  assert.ok(wraps>0,'Exercise real edge recycling');
});
