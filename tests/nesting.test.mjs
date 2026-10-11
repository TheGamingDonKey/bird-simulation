import test from 'node:test';
import assert from 'node:assert/strict';

const module = await import('../advanced/nesting.js').catch(() => null);
const perches = [
  {id:'tent-far',type:'tent',label:'Far roof',x:100,y:8,z:100},
  {id:'tent-home',type:'tent',label:'Village roof',x:35,y:8,z:20},
  {id:'tree-a',type:'tree',label:'First crown',x:10,y:18,z:15},
  {id:'tree-b',type:'tree',label:'Second crown',x:60,y:22,z:25},
  {id:'tree-c',type:'tree',label:'Forage crown',x:5,y:24,z:55},
  {id:'tree-d',type:'tree',label:'East crown',x:80,y:21,z:60},
  {id:'tree-e',type:'tree',label:'West crown',x:-30,y:19,z:25},
];
function simulation(anchors=perches) {
  assert.equal(typeof module?.NestingSimulation,'function','NestingSimulation must be implemented');
  return new module.NestingSimulation(anchors);
}
function at(anchor,perched=false) {
  return {x:anchor.x,y:anchor.y+.4,z:anchor.z,mode:perched?'perched':'flying',perch:perched?{id:anchor.perchId}:null};
}
function advance(s,seconds,player=null) {
  for(let remaining=seconds;remaining>1e-8;remaining-=.1) s.step(Math.min(.1,remaining),player);
}
function hatch(s) {
  const nest=s.nests[0],bird=at(nest,true);
  assert.equal(s.action(bird).ok,true);
  advance(s,12.1,bird);
  assert.ok(nest.eggs.every(egg=>egg.stage==='chick'));
  return {nest,bird};
}
function gather(s,count=2) {
  for(const source of s.foodSources.slice(0,count)) {
    advance(s,.9);
    assert.equal(s.action(at(source)).ok,true);
  }
}

test('brooding and repeated foraging causally raise eggs into fledglings',()=>{
  const s=simulation(),{nest,bird}=hatch(s);
  assert.equal(s.fledged,0);
  for(let cycle=0;cycle<5;cycle++) {
    gather(s);
    for(let i=0;i<2;i++) {
      advance(s,.9);
      assert.equal(s.action(bird).ok,true,'feeding a hungry chick consumes carried food');
    }
    advance(s,6,bird);
    if(nest.eggs.every(egg=>egg.stage==='fledged')) break;
  }
  assert.ok(nest.eggs.every(egg=>egg.stage==='fledged'&&egg.feeds>=2&&egg.age>=24));
  assert.equal(s.fledged,2);
  advance(s,60);
  assert.equal(s.fledged,2,'already fledged chicks count only once');
});

test('eggs incubate only when claimed and perched on their exact anchor',()=>{
  const s=simulation(),nest=s.nests[0],bird=at(nest,true);
  advance(s,20,bird);
  assert.ok(nest.eggs.every(egg=>egg.warmth===0));
  s.action(bird);
  advance(s,6,bird);
  assert.ok(nest.eggs.every(egg=>egg.warmth>=5.9&&egg.stage==='egg'));
  const warmth=nest.eggs[0].warmth;
  advance(s,30,at(nest));
  advance(s,30,{...bird,perch:{id:'different-perch'}});
  assert.equal(nest.eggs[0].warmth,warmth,'hovering and nearby roofs do not brood');
  assert.equal(nest.eggs[0].stage,'egg');
  advance(s,6.1,bird);
  assert.equal(nest.eggs[0].stage,'chick');
});

test('unfed chicks wait safely without growing, dying or bypassing feed requirements',()=>{
  const s=simulation(),{nest,bird}=hatch(s);
  advance(s,90,bird);
  assert.ok(nest.eggs.every(egg=>egg.stage==='chick'&&egg.age===0&&egg.feeds===0&&egg.hunger===1));
  assert.equal(s.action(bird).ok,false);
  assert.equal(s.fledged,0);
  gather(s,1);advance(s,.9);s.action(bird);advance(s,60,bird);
  assert.ok(nest.eggs.every(egg=>egg.stage==='chick'),'one meal cannot raise either chick');
});

test('food collection checks range, limits inventory and waits for source regrowth',()=>{
  const s=simulation(),source=s.foodSources[0],bird=at(source);
  assert.equal(s.action({...bird,y:source.y+8}).ok,false);
  assert.equal(s.action({...bird,x:source.x+10}).ok,false);
  assert.equal(s.action(bird).ok,true);
  assert.equal(s.inventory,1);
  assert.ok(source.cooldown>0);
  assert.equal(s.action(bird).ok,false);
  advance(s,4);
  assert.equal(s.action(bird).ok,false,'source still growing after four seconds');
  advance(s,1.1);
  assert.equal(s.action(bird).ok,true);
  for(let i=0;i<4;i++){advance(s,5.1);s.action(bird);}
  assert.equal(s.inventory,3);
  assert.equal(s.action(bird).ok,false);
});

test('a contextual cooldown prevents rapid repeated feeding from consuming inventory',()=>{
  const s=simulation(),{nest,bird}=hatch(s);gather(s);advance(s,.9);
  assert.equal(s.action(bird).ok,true);
  assert.equal(s.inventory,1);
  assert.equal(s.action(bird).ok,false);
  assert.equal(s.inventory,1);
  assert.equal(nest.eggs.reduce((sum,egg)=>sum+egg.feeds,0),1);
  advance(s,.9);
  assert.equal(s.action(bird).ok,true);
  assert.equal(s.inventory,0);
});

test('pause and invalid dt freeze state; giant dt cannot instantaneously incubate eggs',()=>{
  const s=simulation(),bird=at(s.nests[0],true);s.action(bird);
  const initial=JSON.stringify(s);
  for(const dt of [0,-1,NaN,Infinity,undefined])s.step(dt,bird);
  assert.equal(JSON.stringify(s),initial);
  s.step(900,bird);
  assert.ok(s.time<=.25);
  assert.equal(s.nests[0].eggs[0].stage,'egg');
});

test('reset preserves live records and restores the deterministic nesting cycle',()=>{
  const s=simulation(),nests=s.nests,sources=s.foodSources,nest=s.nests[0],eggs=nest.eggs,egg=eggs[0],source=sources[0];
  const initial=JSON.stringify({nests,sources,inventory:s.inventory,fledged:s.fledged,time:s.time});
  hatch(s);gather(s);s.reset();
  assert.equal(s.nests,nests);assert.equal(s.foodSources,sources);assert.equal(s.nests[0],nest);
  assert.equal(nest.eggs,eggs);assert.equal(nest.eggs[0],egg);assert.equal(s.foodSources[0],source);
  assert.equal(JSON.stringify({nests,sources,inventory:s.inventory,fledged:s.fledged,time:s.time}),initial);
});

test('anchor selection provides a home near the village and separated real tree sites',()=>{
  const s=simulation();
  assert.equal(s.nests[0].perchId,'tent-home');assert.equal(s.nests.length,3);assert.equal(s.foodSources.length,3);
  assert.notEqual(s.nests[1].perchId,s.nests[2].perchId);
  assert.ok(Math.hypot(s.nests[1].x-s.nests[2].x,s.nests[1].z-s.nests[2].z)>=18);
  for(const site of [...s.nests,...s.foodSources]) {
    const anchor=perches.find(p=>p.id===site.perchId);assert.ok(anchor);
    assert.equal(site.x,anchor.x);assert.equal(site.y,anchor.y);assert.equal(site.z,anchor.z);
  }
  const empty=simulation([]);assert.equal(empty.nearestNest({x:0,y:0,z:0}),null);assert.equal(empty.nearestFood({x:0,y:0,z:0}),null);
  assert.equal(empty.action(null).ok,false);
});

test('guidance identifies nest and forage actions without mutating state',()=>{
  const s=simulation(),nest=s.nests[0],bird=at(nest,true),snapshot=JSON.stringify(s);
  assert.equal(s.nearestNest(bird).nest,nest);
  assert.equal(s.nearestFood(at(s.foodSources[0])).source,s.foodSources[0]);
  assert.equal(s.guidance(bird).action,'claim');assert.equal(JSON.stringify(s),snapshot);
  s.action(bird);advance(s,1);
  assert.equal(s.guidance(bird).action,'brood');
  assert.equal(s.guidance(at(s.foodSources[0])).action,'collect');
});
