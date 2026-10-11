import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../advanced/vendor/three.module.min.js';
const module=await import('../advanced/player-view.js').catch(()=>({}));
function setup(){assert.equal(typeof module.createPlayerView,'function');const scene=new THREE.Scene();return module.createPlayerView(THREE,scene);}
const bird=()=>({x:40,y:20,z:50,vx:0,vy:0,vz:-16,yaw:0,pitch:0,turn:0,phase:1,flightClock:1,energy:.8,mode:'flying',flightState:'flap'});

test('the playable bird follows its world position and folds its wings on a perch',()=>{
 const view=setup(),player=bird();view.update(player,true,null);assert.equal(view.root.visible,true);assert.deepEqual(view.root.position.toArray(),[40,20,50]);
 const flight=view.wings[0].rotation.z;player.mode='perched';player.flightState='perch';view.update(player,true,null);assert.notEqual(view.wings[0].rotation.z,flight);
 view.update(player,false,null);assert.equal(view.root.visible,false);assert.equal(view.targetMarker.visible,false);
});
test('landing guidance sits on the actual nearby tree or tent target',()=>{
 const view=setup(),player=bird(),perch={id:'tent-0',type:'tent',x:42,y:8,z:35};
 view.update(player,true,{perch,distance:18,horizontalDistance:15});assert.equal(view.targetMarker.visible,true);assert.equal(view.targetMarker.position.x,42);assert.equal(view.targetMarker.position.z,35);assert.ok(view.targetMarker.position.y>8&&view.targetMarker.position.y<9);
});
test('chase camera starts behind flight, remains above terrain, and frames a landed bird',()=>{
 const view=setup(),player=bird(),camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3()};view.update(player,true,null);view.updateCamera(camera,controls,.016,true);
 assert.ok(camera.position.z>player.z);assert.ok(camera.position.y>player.y);assert.ok(controls.target.z<player.z);
 player.mode='perched';player.y=8;view.update(player,true,null);view.updateCamera(camera,controls,.016,true);assert.ok(camera.position.y>player.y);assert.ok(controls.target.distanceTo(new THREE.Vector3(player.x,player.y,player.z))<2);
});

test('perch guidance uses the same landing height and inclusive reach as flight physics',()=>{
 const view=setup(),player=bird(),perch={id:'tree-boundary',type:'tree',x:40,y:30,z:50};
 player.y=12.2;view.update(player,true,{perch,horizontalDistance:0});assert.equal(view.targetMarker.material.color.getHexString(),'e9bf73');
 player.y=12.4;view.update(player,true,{perch,horizontalDistance:24});assert.equal(view.targetMarker.material.color.getHexString(),'b7edb0');
 assert.ok(Number.isFinite(view.targetMarker.scale.x));
});

test('first-person flight places eyes on the bird, follows pitch and hides its body',()=>{
 const view=setup(),player=bird(),camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3()};
 player.pitch=.4;view.update(player,true,null,true);view.updateCamera(camera,controls,.016,true,'first');
 assert.equal(view.root.visible,false);assert.ok(camera.position.distanceTo(view.root.position)<2);
 assert.ok(controls.target.y>camera.position.y);assert.ok(controls.target.z<camera.position.z);
 view.update(player,true,null,false);view.updateCamera(camera,controls,.016,true,'chase');assert.equal(view.root.visible,true);assert.ok(camera.position.distanceTo(view.root.position)>8);
});

test('first-person eyes remain above rising ground ahead of the bird',async()=>{
 const {terrainHeight}=await import('../advanced/terrain.js');const view=setup(),player=bird(),camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3()};
 Object.assign(player,{x:6,z:-180,y:terrainHeight(6,-180)+1.2,yaw:-Math.PI/2,pitch:0});
 view.update(player,true,null,true);view.updateCamera(camera,controls,.016,true,'first');
 assert.ok(camera.position.y>=terrainHeight(camera.position.x,camera.position.z)+.15);assert.ok(controls.target.x>camera.position.x);
});
