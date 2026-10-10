import * as THREE from './vendor/three.module.min.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {Habitat} from './model.js';
import {terrainHeight} from './terrain.js';
import {createWorld} from './world.js';
import {createBirdView} from './bird-view.js';
const $=id=>document.getElementById(id),canvas=$('view');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'})}catch(error){$('error').hidden=false;throw error}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#c3c6ad',.0021);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.2,1400);camera.position.set(165,115,195);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,20,0);controls.enableDamping=true;controls.dampingFactor=.055;controls.maxPolarAngle=Math.PI*.49;controls.minDistance=12;controls.maxDistance=460;
const hemi=new THREE.HemisphereLight('#f5e5be','#476447',2.8);scene.add(hemi);const sun=new THREE.DirectionalLight('#ffd097',3.5);sun.position.set(-100,170,-70);scene.add(sun);
const skyCanvas=document.createElement('canvas');skyCanvas.width=8;skyCanvas.height=512;const skyCtx=skyCanvas.getContext('2d');const skyTex=new THREE.CanvasTexture(skyCanvas);skyTex.colorSpace=THREE.SRGBColorSpace;
const skyMat=new THREE.MeshBasicMaterial({map:skyTex,side:THREE.BackSide,depthWrite:false});const sky=new THREE.Mesh(new THREE.SphereGeometry(1100,24,16),skyMat);scene.add(sky);
const world=createWorld(THREE,scene),habitat=new Habitat(42,220),birds=createBirdView(scene);
const feedMarkers=new THREE.Group();scene.add(feedMarkers);const ringGeo=new THREE.RingGeometry(2,2.4,32),ringMat=new THREE.MeshBasicMaterial({color:'#f2d18d',side:THREE.DoubleSide,transparent:true,opacity:.85});
let running=true,speed=1,hour=6.5,cameraMode='valley',armed=false,frame=0,last=performance.now(),fpsTime=0,frames=0,toastTimer;
const positionTarget=new THREE.Vector3(),lookTarget=new THREE.Vector3();let transition=0;
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3000)}
function chooseCamera(mode){cameraMode=mode;transition=1;document.querySelector('.intro').classList.toggle('focused',mode==='flock'||mode==='village');document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('selected',b.dataset.camera===mode));if(mode==='village'){positionTarget.set(76,27,79);lookTarget.set(35,5,20)}else{positionTarget.set(165,115,195);lookTarget.set(0,20,0)}controls.enabled=mode!=='flock';toast(mode==='flock'?'Flying alongside the flock':mode==='village'?'At the riverside settlement':'Drag to explore · scroll to zoom')}
document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>chooseCamera(b.dataset.camera));
controls.addEventListener('start',()=>{transition=0});
$('population').oninput=e=>{habitat.setCount(Number(e.target.value));$('population-value').textContent=e.target.value;birds.update(habitat)};
$('speed').oninput=e=>{speed=Number(e.target.value);$('speed-value').textContent=speed+'×'};
$('weather').onchange=e=>{habitat.setWeather(e.target.value);toast(e.target.selectedOptions[0].textContent)};
$('sun').oninput=e=>{hour=Number(e.target.value);updateLight()};
$('pause').onclick=()=>{running=!running;$('pause').textContent=running?'Ⅱ Pause':'▶ Resume'};
$('reset').onclick=()=>{habitat.reset(42);habitat.setCount(Number($('population').value));habitat.setWeather($('weather').value);running=true;$('pause').textContent='Ⅱ Pause';$('hawk').setAttribute('aria-pressed','false');$('hawk').textContent='Release hawk';feedMarkers.clear();chooseCamera('valley');toast('Habitat reset · seed 42')};
$('hawk').onclick=()=>{habitat.togglePredator();const on=habitat.predator.active;$('hawk').setAttribute('aria-pressed',String(on));$('hawk').textContent=on?'Recall hawk':'Release hawk';toast(on?'Hawk released · watch the flock scatter':'Hawk recalled')};
$('feed').onclick=()=>{armed=!armed;$('feed').classList.toggle('armed',armed);$('hint').textContent=armed?'Click the valley to place food':'Drag to explore · scroll to zoom';canvas.style.cursor=armed?'crosshair':''};
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),point=new THREE.Vector3();
canvas.addEventListener('click',e=>{if(!armed)return;pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(world.terrain)[0];if(hit)point.copy(hit.point);if(hit&&Math.abs(point.x)<190&&Math.abs(point.z)<190){habitat.addFood(point.x,point.z);toast('Food placed · birds gather nearby')}else toast('Place food inside the valley');armed=false;$('feed').classList.remove('armed');canvas.style.cursor='';$('hint').textContent='Drag to explore · scroll to zoom'});
$('collapse').onclick=()=>{const hide=!$('panel-body').hidden;$('panel-body').hidden=hide;$('collapse').textContent=hide?'+':'−';$('collapse').setAttribute('aria-expanded',String(!hide))};
let audio,noiseGain,audioOn=false;
$('sound').onclick=async()=>{if(!audio){audio=new AudioContext();const buffer=audio.createBuffer(1,audio.sampleRate*3,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.4;const source=audio.createBufferSource();source.buffer=buffer;source.loop=true;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;noiseGain=audio.createGain();noiseGain.gain.value=0;source.connect(filter).connect(noiseGain).connect(audio.destination);source.start();}await audio.resume();audioOn=!audioOn;noiseGain.gain.setTargetAtTime(audioOn?.1:0,audio.currentTime,.2);$('sound').textContent=audioOn?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(audioOn))};
let lastChirp=0;
function chirp(){if(!audioOn||!running||habitat.time-lastChirp<2)return;lastChirp=habitat.time;const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(1800,t);o.frequency.exponentialRampToValueAtTime(2900,t+.08);o.frequency.exponentialRampToValueAtTime(1400,t+.2);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.015,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.22);o.connect(g).connect(audio.destination);o.start();o.stop(t+.23)}
let daylight=1;
function updateLight(){const d=Math.max(0,Math.sin((hour-6)/24*Math.PI*2));daylight=d;const dawn=hour>=5&&hour<9||hour>17&&hour<20;const top=d>.2?'#8eadb4':dawn?'#9caeb3':'#142e47',middle=dawn?'#ead1a0':d>.2?'#ced7c1':'#354b65',bottom=dawn?'#f0c593':d>.2?'#e8dbb1':'#686c78';const grad=skyCtx.createLinearGradient(0,0,0,512);grad.addColorStop(0,bottom);grad.addColorStop(.5,middle);grad.addColorStop(1,top);skyCtx.fillStyle=grad;skyCtx.fillRect(0,0,8,512);skyTex.needsUpdate=true;hemi.intensity=1.8+d*1.8;sun.intensity=1.4+d*2;sun.color.set(dawn?'#ffbe79':'#fff0cf');sun.position.set(Math.cos(hour/24*Math.PI*2)*170,35+d*160,-100);$('sun-value').textContent=hour<5||hour>=20?'Night':hour<9?'Dawn':hour<17?'Daylight':'Dusk';$('clock').textContent=String(Math.floor(hour)).padStart(2,'0')+':'+String(Math.floor(hour%1*60)).padStart(2,'0')}
updateLight();
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,button'))return;if(e.code==='Space'){e.preventDefault();$('pause').click()}if(e.key.toLowerCase()==='h')$('hawk').click();if(e.key.toLowerCase()==='r')$('reset').click()});
function animate(now){requestAnimationFrame(animate);const elapsed=(now-last)/1000;const dt=Math.min(elapsed,.05);last=now;const simDt=running?dt*speed:0;habitat.step(simDt);world.update(simDt,habitat.time,{weather:habitat.weather,wind:habitat.wind,daylight});birds.update(habitat);chirp();
 if(cameraMode==='flock'&&habitat.birds.length){let x=0,y=0,z=0,n=0;for(const b of habitat.birds){if(b.species!==0)continue;x+=b.x;y+=b.y;z+=b.z;n++}if(n){lookTarget.set(x/n,y/n,z/n);positionTarget.set(x/n+30,y/n+16,z/n+48);camera.position.lerp(positionTarget,1-Math.exp(-dt*2));controls.target.lerp(lookTarget,1-Math.exp(-dt*3));camera.lookAt(controls.target)}}else if(transition>0){camera.position.lerp(positionTarget,1-Math.exp(-dt*3));controls.target.lerp(lookTarget,1-Math.exp(-dt*3));transition-=dt*.5}
 controls.update();sky.position.copy(camera.position);scene.fog.color.set(habitat.weather==='storm'?'#879b9b':daylight<.05?'#536575':'#c6cbb0');scene.fog.density=habitat.weather==='fog'?.009:habitat.weather==='storm'?.004:.002;
 while(feedMarkers.children.length>habitat.food.length)feedMarkers.remove(feedMarkers.children[0]);while(feedMarkers.children.length<habitat.food.length){const ring=new THREE.Mesh(ringGeo,ringMat);ring.rotation.x=-Math.PI/2;feedMarkers.add(ring)}feedMarkers.children.forEach((m,i)=>{const f=habitat.food[i];m.position.set(f.x,terrainHeight(f.x,f.z)+.4,f.z);m.visible=true});renderer.render(scene,camera);frame++;frames++;fpsTime+=elapsed;if(fpsTime>.6){$('fps').textContent=Math.round(frames/fpsTime)+' FPS';$('birds-stat').textContent=habitat.birds.length;$('wind-stat').textContent=Math.hypot(habitat.wind.x,habitat.wind.z).toFixed(1);frames=0;fpsTime=0}
}
requestAnimationFrame(animate);
