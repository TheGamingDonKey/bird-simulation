import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../advanced/vendor/three.module.min.js';
import {createAtmosphere} from '../advanced/atmosphere.js';

test('clouds dim the terrain, lightning illuminates it, and night has little sunlight',()=>{
  const scene=new THREE.Scene(),renderer={shadowMap:{},setPixelRatio(){}};
  const atmosphere=createAtmosphere(THREE,scene,renderer),camera=new THREE.PerspectiveCamera();
  const weather={cloudCover:0,lightning:0,sample:()=>({fog:0,rain:0})};
  atmosphere.update(12,weather,camera);const clear=atmosphere.sun.intensity;
  weather.cloudCover=1;atmosphere.update(12,weather,camera);const overcast=atmosphere.sun.intensity;
  assert.ok(overcast<clear*.5);
  weather.lightning=1;atmosphere.update(12,weather,camera);assert.ok(atmosphere.sun.intensity>clear);
  weather.lightning=0;atmosphere.update(0,weather,camera);assert.equal(atmosphere.sun.intensity,0);
  const stars=scene.children.find(o=>o.isPoints);assert.ok(stars.visible&&stars.material.opacity>0);
  atmosphere.update(12,weather,camera);assert.equal(stars.visible,false);
});
