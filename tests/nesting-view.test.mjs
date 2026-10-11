import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../advanced/vendor/three.module.min.js';
import {createNestingView} from '../advanced/nesting-view.js';
const fixture=()=>({time:0,nests:Array.from({length:3},(_,i)=>({id:`nest-${i}`,label:`Home ${i}`,x:20+i*10,y:7+i,z:-3-i,claimed:false,eggs:[{id:'a',stage:'egg',warmth:0,age:0,hunger:0,feeds:0},{id:'b',stage:'egg',warmth:0,age:0,hunger:0,feeds:0}]})),foodSources:[{id:'food-0',x:80,y:12,z:40,cooldown:0}]});
test('nest stages use existing scene objects and sit at their real perch',()=>{
 const nesting=fixture(),scene=new THREE.Scene(),view=createNestingView(THREE,scene,nesting);
 const objects=[];view.root.traverse(o=>objects.push(o));
 view.update(nesting,{x:0,y:0,z:0,time:0},true);
 const home=view.nestViews[0],slot=home.slots[0];
 assert.deepEqual(home.root.position.toArray(),[20,7.15,-3]);assert.equal(slot.egg.visible,true);assert.equal(slot.bird.visible,false);assert.equal(home.marker.visible,true);
 nesting.nests[0].claimed=true;nesting.nests[0].eggs[0].stage='chick';nesting.nests[0].eggs[0].hunger=.9;nesting.time=2;view.update(nesting,null,true);
 assert.equal(slot.egg.visible,false);assert.equal(slot.bird.visible,true);assert.equal(slot.stage,'chick');
 assert.ok(slot.wings.some(w=>Math.abs(w.rotation.z)>.1),'Hungry chicks should beg with their wings');
 nesting.nests[0].eggs[0].stage='fledged';nesting.time=3;view.update(nesting,null,true);
 nesting.time=8;view.update(nesting,null,true);assert.equal(slot.stage,'fledged');assert.ok(slot.bird.position.y>1);
 const later=[];view.root.traverse(o=>later.push(o));assert.deepEqual(later,objects);
 nesting.time=0;nesting.nests[0].claimed=false;nesting.nests[0].eggs[0].stage='egg';view.update(nesting,null,false);
 assert.equal(slot.egg.visible,true);assert.equal(slot.bird.visible,false);assert.equal(home.marker.visible,false);
 view.root.traverse(o=>{if(o.isMesh&&!o.material.transparent){assert.equal(o.castShadow,true,o.name);assert.equal(o.receiveShadow,true,o.name);}});
});
test('food seeds and pilot halos reflect cooldown without moving off their source',()=>{
 const nesting=fixture(),view=createNestingView(THREE,new THREE.Scene(),nesting),food=view.foodViews[0];
 view.update(nesting,null,true);assert.equal(food.available,true);assert.equal(food.seeds.visible,true);assert.equal(food.marker.visible,true);
 assert.deepEqual(food.root.position.toArray(),[80,12.09,40]);
 nesting.foodSources[0].cooldown=4;nesting.time=1;view.update(nesting,null,true);
 assert.equal(food.available,false);assert.equal(food.seeds.visible,false);assert.ok(food.marker.material.opacity<.4);
 nesting.foodSources[0].cooldown=0;view.update(nesting,null,false);assert.equal(food.seeds.visible,true);assert.equal(food.marker.visible,false);
});
