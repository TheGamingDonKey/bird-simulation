import * as THREE from './vendor/three.module.min.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {Habitat} from './model.js';
import {terrainHeight} from './terrain.js';
import {createWorld} from './world.js';
import {createBirdView} from './bird-view.js';
import {createAtmosphere} from './atmosphere.js';
import {createNavigation} from './navigation.js';
import {createMinimap} from './minimap.js';
import {setupAudio} from './audio.js';
import {PlayerBird} from './player-bird.js';
import {createPlayerView} from './player-view.js';
import {createFlightInput} from './flight-input.js';
import {NestingSimulation} from './nesting.js';
import {createNestingView} from './nesting-view.js';
import {BirdSocial} from './bird-social.js';

const $=id=>document.getElementById(id),canvas=$('view');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){$('error').hidden=false;throw error;}
renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.2,1400);
camera.position.set(165,115,195);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,20,0);controls.enableDamping=true;controls.dampingFactor=.055;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=5;controls.maxDistance=460;controls.update();
const atmosphere=createAtmosphere(THREE,scene,renderer);atmosphere.quality('balanced');
const world=createWorld(THREE,scene),habitat=new Habitat(42,220),birds=createBirdView(scene);
const navigation=createNavigation(THREE,camera,controls,canvas);
const player=new PlayerBird(world.perches),playerView=createPlayerView(THREE,scene);
const nesting=new NestingSimulation(world.perches),nestView=createNestingView(THREE,scene,nesting),social=new BirdSocial();
let piloting=false,viewpoint='chase',familyPage=false;
const companionMarker=new THREE.Mesh(new THREE.RingGeometry(1.4,1.49,32),new THREE.MeshBasicMaterial({color:'#aee9d5',side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));companionMarker.name='Companion outline';companionMarker.visible=false;scene.add(companionMarker);
const feedMarkers=new THREE.Group();scene.add(feedMarkers);
const ringGeo=new THREE.RingGeometry(2,2.4,32),ringMat=new THREE.MeshBasicMaterial({color:'#f2d18d',side:THREE.DoubleSide,transparent:true,opacity:.85});
let running=true,speed=1,hour=8.2,cameraMode='valley',action=null,last=performance.now(),fpsTime=0,frames=0,toastTimer,tourTime=0,daylight=1;
const positionTarget=new THREE.Vector3(),lookTarget=new THREE.Vector3();let transition=0;
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function hint(){
 if(piloting){$('hint').textContent='W/S climb & dive · A/D steer · Space flap · Shift glide · L land · F chirp · P pause';canvas.style.cursor='';return;}
 const text=action?'Click the terrain to '+(action==='feed'?'place food':action==='gather'?'gather villagers':'startle nearby villagers'):navigation.mode==='fly'?'WASD / arrows · drag to look · Q/E altitude · Shift boost':navigation.mode==='walk'?'WASD / arrows · drag to look · Shift run':navigation.mode==='bird'?'Following one bird · watch it bank and glide':navigation.mode==='tour'?'Automatic tour · choose another camera to explore':'Drag to explore · scroll to zoom';
 $('hint').textContent=text;canvas.style.cursor=action?'crosshair':'';
}
function chooseCamera(mode){
 setPiloting(false);
 cameraMode=mode;navigation.setMode('orbit');$('navigation').value='orbit';transition=1;
 document.querySelector('.intro').classList.toggle('focused',mode==='flock'||mode==='village');
 document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('selected',b.dataset.camera===mode));
 if(mode==='village'){positionTarget.set(72,19,64);lookTarget.set(35,4,20);}else{positionTarget.set(165,115,195);lookTarget.set(0,20,0);}
 if(mode!=='flock'){camera.position.copy(positionTarget);controls.target.copy(lookTarget);camera.lookAt(lookTarget);transition=0;}controls.enabled=mode!=='flock';hint();
}
document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>{chooseCamera(b.dataset.camera);toast(b.dataset.camera==='flock'?'Flying alongside the flock':b.dataset.camera==='village'?'At the riverside settlement':'Drag to explore · scroll to zoom');});
controls.addEventListener('start',()=>{transition=0;});
$('navigation').onchange=e=>{
 const mode=e.target.value;if(mode==='player'){setPiloting(true);return;}setPiloting(false);e.target.value=mode;
 transition=0;cameraMode='explore';navigation.setMode(e.target.value);document.querySelector('.intro').classList.toggle('focused',e.target.value!=='orbit');
 document.querySelectorAll('[data-camera]').forEach(b=>b.classList.remove('selected'));e.target.blur();hint();toast(e.target.selectedOptions[0].textContent);
};
$('population').oninput=e=>{habitat.setCount(Number(e.target.value));$('population-value').textContent=e.target.value;};
$('speed').oninput=e=>{speed=Number(e.target.value);$('speed-value').textContent=speed+'×';};
$('weather').onchange=e=>{habitat.setWeather(e.target.value);toast('Weather front changing · watch the map');};
$('sun').oninput=e=>{hour=Number(e.target.value);};
$('quality').onchange=e=>{atmosphere.quality(e.target.value);renderer.setSize(innerWidth,innerHeight);toast(e.target.selectedOptions[0].textContent+' rendering');};
$('pause').onclick=()=>{flightInput.clear();running=!running;$('pause').textContent=running?'Ⅱ Pause':'▶ Resume';};
$('reset').onclick=()=>{
 player.reset(world.perches);nesting.reset();social.reset();flightInput.clear();
 habitat.reset(42);habitat.setCount(Number($('population').value));habitat.setWeather($('weather').value);world.reset();running=true;
 $('pause').textContent='Ⅱ Pause';$('hawk').setAttribute('aria-pressed','false');$('hawk').textContent='Release hawk';feedMarkers.clear();action=null;tourTime=0;chooseCamera('valley');
 for(const id of ['feed','gather','scare'])$(id).classList.remove('armed');toast('Habitat reset · seed 42');
};
$('hawk').onclick=()=>{habitat.togglePredator();const on=habitat.predator.active;$('hawk').setAttribute('aria-pressed',String(on));$('hawk').textContent=on?'Recall hawk':'Release hawk';toast(on?'Hawk released · watch the flock scatter':'Hawk recalled');};
for(const kind of ['feed','gather','scare'])$(kind).onclick=()=>{action=action===kind?null:kind;for(const id of ['feed','gather','scare'])$(id).classList.toggle('armed',action===id);hint();};
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down={x:0,y:0};
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
canvas.addEventListener('click',e=>{
 if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;
 pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);raycaster.setFromCamera(pointer,camera);
 const hit=raycaster.intersectObject(world.terrain)[0];if(!hit)return;
 if(action){const {x,z}=hit.point;if(Math.abs(x)>205||Math.abs(z)>205){toast('Choose a point inside the valley');return;}
  if(action==='feed'){habitat.addFood(x,z);toast('Food placed · birds gather nearby');}else if(action==='gather'){world.interact(x,z);toast('Villagers are gathering on the dry riverbank');}else{world.scare(x,z);toast('Nearby villagers startle and run');}
  action=null;for(const id of ['feed','gather','scare'])$(id).classList.remove('armed');hint();
 }else{
  let nearest=null,distance=Infinity;for(const p of world.villagers){const d=Math.hypot(p.x-hit.point.x,p.z-hit.point.z);if(d<distance){nearest=p;distance=d;}}
  if(distance<5)toast(nearest.name+' · '+nearest.state.replaceAll('_',' '));
 }
});
$('collapse').onclick=()=>{const hide=!$('panel-body').hidden;$('panel-body').hidden=hide;$('collapse').textContent=hide?'+':'−';$('collapse').setAttribute('aria-expanded',String(!hide));};
$('cinema').onclick=()=>{const clean=document.body.classList.toggle('clean');$('cinema').textContent=clean?'Show controls':'Hide interface';};
const chirp=setupAudio($('sound'),habitat,()=>running);
const flightInput=createFlightInput(document,()=>piloting&&running,landPlayer,chirpPlayer);
function setPiloting(active){
 piloting=active;flightInput.clear();document.body.classList.toggle('pilot-mode',active);$('player-hud').hidden=!active;
 $('play-bird').setAttribute('aria-pressed',String(active));$('play-bird').textContent=active?'Return to habitat camera':'Take control of a bird';
 navigation.setMode('orbit');controls.enabled=!active;$('navigation').value=active?'player':'orbit';
 if(active){cameraMode='pilot';transition=0;action=null;for(const id of ['feed','gather','scare'])$(id).classList.remove('armed');document.querySelectorAll('[data-camera]').forEach(b=>b.classList.remove('selected'));document.querySelector('.intro').classList.add('focused');playerView.update(player,true,player.nearestPerch(),viewpoint==='first');playerView.updateCamera(camera,controls,0,true,viewpoint);camera.fov=viewpoint==='first'?78:52;camera.updateProjectionMatrix();canvas.focus();}
 else{camera.fov=52;camera.updateProjectionMatrix();playerView.update(player,false);document.querySelector('.intro').classList.remove('focused');}
 hint();
}
function landPlayer(){if(!piloting||!running)return;flightInput.clear();toast(player.requestLand().message);canvas.focus();}
function chirpPlayer(){if(!piloting||!running)return;toast(player.chirp()?social.call(player,habitat).message:'Give your bird a moment before chirping again');canvas.focus();}
$('play-bird').onclick=()=>piloting?chooseCamera('valley'):setPiloting(true);$('leave-bird').onclick=()=>chooseCamera('valley');
$('land-bird').onclick=landPlayer;$('chirp-bird').onclick=chirpPlayer;

function showFamily(active){familyPage=active;$('flight-page').hidden=active;$('family-page').hidden=!active;$('tab-family').classList.toggle('selected',active);$('tab-flight').classList.toggle('selected',!active);}
$('tab-flight').onclick=()=>showFamily(false);$('tab-family').onclick=()=>showFamily(true);
function switchView(){if(!piloting)return;viewpoint=viewpoint==='chase'?'first':'chase';$('bird-viewpoint').textContent=viewpoint==='first'?'Chase view · V':'First person · V';$('bird-viewpoint').setAttribute('aria-pressed',String(viewpoint==='first'));camera.fov=viewpoint==='first'?78:52;camera.updateProjectionMatrix();playerView.update(player,true,player.nearestPerch(),viewpoint==='first');playerView.updateCamera(camera,controls,0,true,viewpoint);canvas.focus();}
$('bird-viewpoint').onclick=switchView;
function carePlayer(){if(!piloting||!running)return;toast(nesting.action(player).message);updateFamily();canvas.focus();}
function greetPlayer(){if(!piloting||!running)return;toast(social.greet(player,habitat).message);updateFamily();canvas.focus();}
function sharePlayer(){if(!piloting||!running)return;const result=social.feed(player,habitat,nesting.inventory);nesting.inventory-=result.consumed||0;toast(result.message);updateFamily();canvas.focus();}
$('care-bird').onclick=carePlayer;$('greet-bird').onclick=greetPlayer;$('share-bird').onclick=sharePlayer;
$('practice-go').onclick=()=>{
 const kind=$('practice-location').value,home=nesting.nests.find(n=>n.claimed)||nesting.nests[0];let perch;
 const landings=player.landings;
 if(kind==='flock'){const near=habitat.birds.reduce((a,b)=>!a||Math.hypot(b.x-player.x,b.y-player.y,b.z-player.z)<Math.hypot(a.x-player.x,a.y-player.y,a.z-player.z)?b:a,null);if(!near)return;player.reset(world.perches);Object.assign(player,{x:near.x-4,y:near.y+1,z:near.z+3,yaw:Math.atan2(-near.vx,-near.vz),vx:near.vx,vy:near.vy,vz:near.vz});showFamily(true);}
 else{perch=kind==='nest'?world.perches.find(p=>p.id===home.perchId):kind==='food'?world.perches.find(p=>p.id===nesting.foodSources[0]?.perchId):world.perches.filter(p=>p.type===kind).sort((a,b)=>Math.hypot(a.x-35,a.z-20)-Math.hypot(b.x-35,b.z-20))[0];if(!perch)return;player.reset([perch]);player.x=perch.x;player.z=perch.z+4;player.y=Math.max(perch.y+3,terrainHeight(player.x,player.z)+1.5);player.requestLand();player.setPerches(world.perches);showFamily(kind==='nest'||kind==='food');}
 player.landings=landings;setPiloting(true);updateFamily();toast('Practice travel · '+(kind==='flock'?'beside nearby birds · B greets, F calls':'approaching '+(kind==='nest'?'home nest':kind==='food'?'foraging tree':kind)+' · E interacts after landing'));
};
function updateFamily(){
 const home=nesting.nests.find(n=>n.claimed)||nesting.nests[0],near=nesting.nearestNest(player),nest=player.mode==='perched'&&near?.horizontalDistance<3?near.nest:home;if(!nest)return;
 $('nest-title').textContent=nest.label+(nest.claimed?' · yours':' · unclaimed');$('food-inventory').textContent='Food '+nesting.inventory+' / 3 · '+nesting.fledged+' fledged';
 const guidance=nesting.guidance(player),food=nesting.nearestFood(player);$('family-objective').textContent=guidance.message+' Home '+Math.round(Math.hypot(player.x-home.x,player.y-home.y,player.z-home.z))+' away · food '+Math.round(food?.distance||0)+' away.';$('care-bird').textContent=({claim:'Claim nest',feed:'Feed chick',collect:'Collect food',brood:'Brood',wait:'Wait',return:'Return home',land:'Land first',travel:'Interact',forage:'Find food',complete:'Family raised'}[guidance.action]||'Interact')+' · E';
 const cards=nest.eggs.map(egg=>{const stage=egg.stage==='egg'?'Egg · '+Math.round(egg.warmth/12*100)+'% warm':egg.stage==='chick'?'Chick · '+(egg.hunger>=.35?'hungry':'fed'):'Fledgling';const value=egg.stage==='egg'?egg.warmth/12:egg.stage==='chick'?egg.age/24:1;return '<div class="egg-card"><b>'+stage+'</b><progress max="1" value="'+Math.min(1,value)+'"></progress><span>'+(egg.stage==='egg'?'Brood while perched':egg.stage==='chick'?Math.floor(egg.age/24*100)+'% grown · '+egg.feeds+' meals':'Ready for the sky')+'</span></div>';}).join('');if($('egg-status').innerHTML!==cards)$('egg-status').innerHTML=cards;
 $('social-status').textContent=(social.companionId!==null?'Companion outlined in mint. ':'' )+social.friends+' friends · F call · B greet · G share food';
 canvas.dataset.family=JSON.stringify({inventory:nesting.inventory,fledged:nesting.fledged,time:nesting.time,nest:nest.id,claimed:nest.claimed,eggs:nest.eggs.map(e=>({stage:e.stage,warmth:e.warmth,age:e.age,hunger:e.hunger,feeds:e.feeds})),friends:social.friends,companion:social.companionId});
}
document.querySelectorAll('[data-flight]').forEach(button=>{
 const release=()=>{flightInput.hold(button.dataset.flight,false);button.classList.remove('held');};
 button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);flightInput.hold(button.dataset.flight,true);button.classList.add('held');});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
 button.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();flightInput.hold(button.dataset.flight,true);}});button.addEventListener('keyup',release);button.addEventListener('blur',release);
});
const mapDraw=createMinimap($('map'),habitat,world,camera,(x,z)=>{
 if(piloting)setPiloting(false);
 if(navigation.mode==='bird'||navigation.mode==='tour'){navigation.setMode('fly');$('navigation').value='fly';}
 cameraMode='explore';controls.enabled=navigation.mode==='orbit';document.querySelectorAll('[data-camera]').forEach(b=>b.classList.remove('selected'));
 transition=0;camera.position.set(x,Math.max(terrainHeight(x,z)+8,navigation.mode==='walk'?terrainHeight(x,z)+2:camera.position.y),z);controls.target.set(x,terrainHeight(x,z)+3,z-30);hint();toast('Moved to map location');
},()=>piloting?player:null,()=>nesting.nests);
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);
document.addEventListener('keydown',e=>{if(e.code==='Escape'&&document.body.classList.contains('clean')){$('cinema').click();return;}if(e.target.matches('input,select,button,textarea'))return;if(piloting&&!e.repeat){if(e.code==='KeyV')switchView();if(running&&e.code==='KeyE')carePlayer();if(running&&e.code==='KeyB')greetPlayer();if(running&&e.code==='KeyG')sharePlayer();}if(e.code==='KeyP'||(e.code==='Space'&&!piloting)){e.preventDefault();flightInput.clear();$('pause').click();}if(e.key.toLowerCase()==='h')$('hawk').click();if(e.key.toLowerCase()==='r')$('reset').click();});
function animate(now){
 requestAnimationFrame(animate);const elapsed=(now-last)/1000,dt=Math.min(elapsed,.05);last=now;const simDt=running?dt*speed:0;
 // Advance weather, birds and village together, including at high time speeds.
 const simStart=performance.now();if(piloting&&running)player.step(dt,flightInput.read(),{wind:habitat.wind,weatherSystem:habitat.weatherSystem});if(running){nesting.step(dt,piloting?player:null);social.step(dt,piloting?player:null,habitat);}nestView.update(nesting,player,piloting);let remaining=simDt;while(remaining>1e-8){const step=Math.min(remaining,.04);habitat.step(step);world.update(step,habitat.time,{weather:habitat.weather,wind:habitat.wind,weatherSystem:habitat.weatherSystem,daylight,visitor:piloting?player:null});remaining-=step;}
 birds.update(habitat);const simCost=performance.now()-simStart;chirp();if(running)tourTime+=dt;
 if($('day-cycle').checked&&running){hour=(hour+simDt*.035)%24;$('sun').value=hour;}
 daylight=atmosphere.update(hour,habitat.weatherSystem,camera);
 if(piloting){const nearest=player.perch?{perch:player.perch,horizontalDistance:Math.hypot(player.x-player.perch.x,player.z-player.perch.z)}:player.nearestPerch();playerView.update(player,true,nearest,viewpoint==='first');playerView.updateCamera(camera,controls,dt,false,viewpoint);}
 else if(cameraMode==='flock'&&habitat.birds.length){let x=0,y=0,z=0,n=0;for(const b of habitat.birds){if(b.species!==0)continue;x+=b.x;y+=b.y;z+=b.z;n++;}if(n){lookTarget.set(x/n,y/n,z/n);positionTarget.set(x/n+30,y/n+16,z/n+48);camera.position.lerp(positionTarget,1-Math.exp(-dt*2));controls.target.lerp(lookTarget,1-Math.exp(-dt*3));camera.lookAt(controls.target);}}
 else if(transition>0){camera.position.lerp(positionTarget,1-Math.exp(-dt*3));controls.target.lerp(lookTarget,1-Math.exp(-dt*3));transition-=dt*.5;}
 if(!piloting){navigation.update(dt,habitat,tourTime);if(navigation.mode==='orbit'&&cameraMode!=='flock')controls.update();}
 const companion=social.companionBird;companionMarker.visible=piloting&&!!companion;if(companion){companionMarker.position.set(companion.x,companion.y,companion.z);companionMarker.quaternion.copy(camera.quaternion);}
 while(feedMarkers.children.length>habitat.food.length)feedMarkers.remove(feedMarkers.children[0]);while(feedMarkers.children.length<habitat.food.length){const ring=new THREE.Mesh(ringGeo,ringMat);ring.rotation.x=-Math.PI/2;feedMarkers.add(ring);}
 feedMarkers.children.forEach((m,i)=>{const f=habitat.food[i];m.position.set(f.x,terrainHeight(f.x,f.z)+.4,f.z);});const renderStart=performance.now();renderer.render(scene,camera);const renderCost=performance.now()-renderStart;
 frames++;fpsTime+=elapsed;if(fpsTime>.5){
  if(piloting){updateFamily();canvas.dataset.viewpoint=viewpoint;const nearest=player.nearestPerch();$('flight-state').textContent=running?(player.mode==='perched'?'Perched':player.mode==='landing'?'Landing':player.flightState==='glide'?'Gliding':'Flying'):'Paused';$('flight-altitude').textContent=Math.max(0,player.y-terrainHeight(player.x,player.z)).toFixed(1);$('flight-speed').textContent=player.speed.toFixed(1);$('flight-energy').value=player.energy;$('flight-landings').textContent=player.landings;$('perch-label').textContent=player.perch?player.perch.label:nearest?nearest.perch.label+' · '+Math.round(nearest.distance)+' away':'No perch nearby';$('land-bird').textContent=player.mode==='perched'?'Take off · L':player.mode==='landing'?'Cancel · L':'Land · L';canvas.dataset.player=JSON.stringify({x:player.x,y:player.y,z:player.z,mode:player.mode,perch:player.perch?.type,landings:player.landings,time:player.time});}else delete canvas.dataset.player;
  mapDraw();$('fps').textContent=Math.round(frames/fpsTime)+' FPS';$('fps').title='CPU simulation '+simCost.toFixed(1)+' ms · render '+renderCost.toFixed(1)+' ms · frame gap '+Math.round(elapsed*1000)+' ms · '+renderer.info.render.calls+' draw calls';canvas.dataset.camera=[camera.position.x,camera.position.y,camera.position.z].map(n=>n.toFixed(2)).join(',');$('birds-stat').textContent=habitat.birds.length;$('wind-stat').textContent=Math.hypot(habitat.wind.x,habitat.wind.z).toFixed(1);
  const local=habitat.weatherSystem.sample(camera.position.x,camera.position.z);$('weather-status').textContent=local.rain>.35?'Rain overhead':local.snow>.3?'Snow overhead':local.fog>.25?'Mist overhead':'Fronts drifting';
  const active=world.villagers.filter(p=>p.state==='shelter'||p.state==='sheltering').length;$('village-status').textContent=active?active+' seeking shelter':world.villagers.filter(p=>p.reaction).length+' reacting · 34 wild animals';
  $('sun-value').textContent=hour<5||hour>=20?'Night':hour<9?'Morning':hour<17?'Daylight':'Dusk';$('clock').textContent=String(Math.floor(hour)).padStart(2,'0')+':'+String(Math.floor(hour%1*60)).padStart(2,'0');frames=0;fpsTime=0;
 }
}
if(innerWidth<560){$('panel-body').hidden=true;$('collapse').textContent='+';$('collapse').setAttribute('aria-expanded','false');}
requestAnimationFrame(animate);
