import {riverX} from './terrain.js';
export function createMinimap(canvas,habitat,world,camera,onJump,getPlayer=()=>null,getNests=()=>[]){
  const ctx=canvas.getContext('2d'),size=canvas.width,scale=size/560;
  const map=n=>size/2+n*scale;
  canvas.addEventListener('click',event=>{const r=canvas.getBoundingClientRect();onJump(((event.clientX-r.left)/r.width-.5)*560,((event.clientY-r.top)/r.height-.5)*560);});
  return function draw(){
    ctx.fillStyle='#142f2b';ctx.fillRect(0,0,size,size);ctx.strokeStyle='#37594b';ctx.lineWidth=1;
    for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(i*size/4,0);ctx.lineTo(i*size/4,size);ctx.moveTo(0,i*size/4);ctx.lineTo(size,i*size/4);ctx.stroke();}
    for(const f of habitat.weatherSystem.fronts){if(f.intensity<.03)continue;ctx.globalAlpha=Math.min(1,f.intensity);ctx.fillStyle=f.type==='snow'?'#dbeaf52e':f.type==='fog'?'#d8d6b330':'#71a9d631';ctx.beginPath();ctx.arc(map(f.x),map(f.z),f.radius*scale,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    ctx.strokeStyle='#78a5ad';ctx.lineWidth=3;ctx.beginPath();for(let z=-280;z<=280;z+=5){const x=map(riverX(z));if(z===-280)ctx.moveTo(x,map(z));else ctx.lineTo(x,map(z));}ctx.stroke();
    for(const b of habitat.birds){ctx.fillStyle=['#d5b975','#d4e9ec','#d38763'][b.species];ctx.fillRect(map(b.x),map(b.z),1.5,1.5);}
    for(const animal of world.wildlife||[]){ctx.fillStyle=animal.type==='fish'?'#77d4dd':'#a9d59a';ctx.fillRect(map(animal.x),map(animal.z),2,2);}
    for(const nest of getNests()){ctx.strokeStyle=nest.claimed?'#ffdb7c':'#c4ecb1';ctx.lineWidth=1.5;ctx.strokeRect(map(nest.x)-3,map(nest.z)-3,6,6);}
    const player=getPlayer();if(player){ctx.strokeStyle='#ffe072';ctx.lineWidth=2;ctx.beginPath();ctx.arc(map(player.x),map(player.z),5,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle='#ffd89a';ctx.beginPath();ctx.arc(map(35),map(20),3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(map(camera.position.x),map(camera.position.z),3,0,Math.PI*2);ctx.fill();
  };
}
