import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../advanced/flight-input.js').catch(()=>({}));
function surface(){const listeners=new Map();return {defaultView:null,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},send(type,event){for(const fn of listeners.get(type)||[])fn(event);},count(){return [...listeners.values()].reduce((n,set)=>n+set.size,0);}};}
function setup(){assert.equal(typeof module.createFlightInput,'function');const doc=surface(),win=surface();doc.defaultView=win;let active=true,land=0,chirps=0;const input=module.createFlightInput(doc,()=>active,()=>land++,()=>chirps++);return {doc,win,input,setActive(v){active=v;},counts(){return {land,chirps};}};}
const event=(code,target={tagName:'CANVAS'})=>({code,target,repeat:false,preventDefault(){this.prevented=true;}});

test('bird control keys steer, climb, flap and glide without triggering page shortcuts',()=>{
 const {doc,input}=setup();const space=event('Space');doc.send('keydown',space);doc.send('keydown',event('KeyW'));doc.send('keydown',event('KeyD'));
 assert.deepEqual(input.read(),{turn:1,pitch:1,flap:true,glide:false});assert.equal(space.prevented,true);
 doc.send('keyup',event('Space'));doc.send('keydown',event('ShiftLeft'));assert.equal(input.read().flap,false);assert.equal(input.read().glide,true);
 input.dispose();assert.equal(doc.count(),0);
});
test('landing/chirping are one-shot actions and form focus or inactivity blocks piloting',()=>{
 const {doc,input,setActive,counts}=setup();doc.send('keydown',event('KeyL'));doc.send('keydown',{...event('KeyL'),repeat:true});doc.send('keydown',event('KeyF'));assert.deepEqual(counts(),{land:1,chirps:1});
 doc.send('keydown',event('KeyW',{tagName:'SELECT'}));assert.equal(input.read().pitch,0);
 setActive(false);doc.send('keydown',event('Space'));doc.send('keydown',event('KeyL'));assert.equal(input.read().flap,false);assert.equal(counts().land,1);
});
test('blur, form focus and pointer releases clear held flight actions',()=>{
 const {doc,win,input}=setup();input.hold('left',true);input.hold('flap',true);assert.equal(input.read().turn,-1);assert.equal(input.read().flap,true);
 input.hold('flap',false);assert.equal(input.read().flap,false);win.send('blur',{});assert.equal(input.read().turn,0);
 doc.send('keydown',event('ArrowUp'));doc.send('focusin',{target:{tagName:'INPUT'}});assert.equal(input.read().pitch,0);
 input.dispose();assert.equal(win.count(),0);
});
