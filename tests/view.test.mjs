import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../advanced/vendor/three.module.min.js';
import {createBirdView} from '../advanced/bird-view.js';
import {createWorld} from '../advanced/world.js';
test('bird forward axis follows climbing velocity at any heading',()=>{
 const scene=new THREE.Scene(),view=createBirdView(scene);
 const b={x:0,y:20,z:0,vx:10,vy:5,vz:0,species:0,phase:0};
 view.update({birds:[b],time:0,predator:{active:false,x:0,y:0,z:0}});
 const body=scene.children.find(o=>o.isInstancedMesh),matrix=new THREE.Matrix4();body.getMatrixAt(0,matrix);
 const actual=new THREE.Vector3().setFromMatrixColumn(matrix,2).normalize(),expected=new THREE.Vector3(10,5,0).normalize();
 assert.ok(actual.dot(expected)>.999,'Bird body should aim along its 3D velocity');
});
test('clear weather hides precipitation; mixed enables both regional fronts',()=>{
 // Texture pixels are irrelevant to visibility; supply only the browser canvas boundary.
 const previousDocument=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},createRadialGradient(){return {addColorStop(){}}}})})};
 const scene=new THREE.Scene(),world=createWorld(THREE,scene);
 globalThis.document=previousDocument;
 const rain=world.root.children.find(o=>o.isLineSegments),snow=world.root.children.find(o=>o.isPoints&&o.material.size===.35);
 assert.ok(rain&&snow);
 world.update(1/60,1,{weather:'clear'});
 assert.equal(rain.visible,false);assert.equal(snow.visible,false);
 world.update(1/60,2,{weather:'mixed'});
 assert.equal(rain.visible,true);assert.equal(snow.visible,true);
 world.update(1/60,3,{weather:'rain'});
 assert.equal(rain.visible,true);assert.equal(snow.visible,false);
 world.update(1/60,4,{weather:'snow'});
 assert.equal(rain.visible,false);assert.equal(snow.visible,true);
});
