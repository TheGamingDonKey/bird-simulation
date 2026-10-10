import {riverX,terrainHeight} from './terrain.js';

export class WildlifeSimulation{
 constructor({seed=81641,groves=[]}={}){
  this.seed=seed>>>0;this.time=0;this.animals=[];
  for(let i=0;i<34;i++){
   const type=i<8?'deer':i<20?'rabbit':'fish',n=type==='deer'?i:type==='rabbit'?i-8:i-20;
   const z=type==='deer'?-65+Math.floor(n/4)*38:type==='rabbit'?45+Math.floor(n/4)*12:-140+n*21;
   const x=type==='deer'?65+n%4*16:type==='rabbit'?42+n%4*11:riverX(z)+(this.random()-.5)*5;
   const point=type==='fish'?{x,z}:this.dryPoint(x,z);
   let home={x:type==='deer'?105+n%4*12:85+n%4*7,z:type==='deer'?-72+Math.floor(n/4)*32:42+Math.floor(n/4)*10};
   const grove=groves.filter(g=>g.x>riverX(g.z)+19).reduce((best,g)=>!best||Math.hypot(g.x-point.x,g.z-point.z)<Math.hypot(best.x-point.x,best.z-point.z)?g:best,null);
   if(grove)home={x:grove.x,z:grove.z};
   this.animals.push({id:i,type,name:`${type} ${n+1}`,x:point.x,z:point.z,y:type==='fish'?-2.82:terrainHeight(point.x,point.z),heading:this.random()*Math.PI*2,phase:this.random()*Math.PI*2,
    state:type==='fish'?'swim':'graze',intent:type==='fish'?'swim':'graze',speed:0,goal:{...point},home,until:3+this.random()*7,cooldown:0,scatterUntil:0,lookX:0,lookZ:0});
  }
  this.initialSeed=this.seed;this.initial=this.animals.map(a=>({...a,goal:{...a.goal},home:{...a.home}}));
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 reset(){this.seed=this.initialSeed;this.time=0;this.animals.length=this.initial.length;for(let i=0;i<this.initial.length;i++){this.animals[i]??={};Object.assign(this.animals[i],this.initial[i],{goal:{...this.initial[i].goal},home:{...this.initial[i].home}});}}
 dryPoint(x,z){
  z=Math.max(-240,Math.min(240,z));x=Math.max(riverX(z)+16,Math.min(240,x));
  const dx=x-35,dz=z-20,d=Math.hypot(dx,dz);if(d<23){x=35+(dx/(d||1))*23;z=20+(dz/(d||1))*23;x=Math.max(riverX(z)+16,x);}
  return{x,z};
 }
 choose(a){
  const angle=this.random()*Math.PI*2,distance=8+this.random()*18;
  const drink=this.random()<.2;
  a.goal=drink?this.dryPoint(riverX(a.z)+16.5,a.z+(this.random()-.5)*20):this.dryPoint(a.home.x+Math.cos(angle)*distance,a.home.z+Math.sin(angle)*distance);
  a.state='wander';a.intent=drink?'drink':'graze';
 }
 step(dt,options={}){if(!(dt>0)||!Number.isFinite(dt))return;let left=Math.min(dt,1);while(left>1e-8){const h=Math.min(.05,left);this.tick(h,options);left-=h;}}
 tick(dt,options){
  this.time+=dt;
  for(const a of this.animals){
   const visitor=options.visitor,distance=visitor?Math.hypot(visitor.x-a.x,visitor.z-a.z):Infinity,height=visitor?visitor.y-a.y:Infinity;
   if(a.type==='fish'){
    if(visitor&&distance<12&&height<5&&this.time>a.cooldown){a.scatterUntil=this.time+2;a.cooldown=this.time+8;}
    a.state=this.time<a.scatterUntil?'dive':'swim';a.phase+=dt*(a.state==='dive'?6:2.2);a.z=Math.max(-230,Math.min(230,a.z+Math.sin(this.time*.21+a.id)*dt*1.1));a.x=riverX(a.z)+Math.sin(this.time*.42+a.id*2.4)*3.7;a.y=-2.72-(a.state==='dive'?.7:.09+Math.sin(a.phase)*.04);a.heading=Math.atan2(Math.cos(this.time*.42+a.id*2.4),Math.sin(this.time*.21+a.id));a.speed=1.1;continue;
   }
   const local=options.weatherSystem?.sample(a.x,a.z),wet=local?(local.rain>.35||local.snow>.3):['rain','snow','storm'].includes(options.weather);
   if(wet){a.goal={...a.home};a.intent='shelter';a.state='sheltering';a.scatterUntil=0;}
   else if(a.intent==='shelter'){this.choose(a);}
   if(!wet&&visitor&&distance<22&&height>-1&&height<12&&this.time>=a.cooldown){
    const speed=visitor.speed??Math.hypot(visitor.vx||0,visitor.vy||0,visitor.vz||0);
    const chirping=visitor.chirpUntil>(visitor.time??this.time);
    if(speed>12||chirping){const angle=Math.atan2(a.z-visitor.z,a.x-visitor.x)+.35;a.goal=this.dryPoint(a.x+Math.cos(angle)*24,a.z+Math.sin(angle)*24);a.state='scatter';a.scatterUntil=this.time+5;a.cooldown=this.time+12;}
    else{a.state='watch';a.until=this.time+3;a.cooldown=this.time+9;a.lookX=visitor.x;a.lookZ=visitor.z;}
   }
   if(a.state==='watch'&&this.time<a.until){a.speed=0;a.heading=Math.atan2(a.lookX-a.x,a.lookZ-a.z);continue;}
   if(a.state==='watch'||(a.state==='scatter'&&this.time>=a.scatterUntil)||(['graze','drink'].includes(a.state)&&this.time>a.until))this.choose(a);
   const dx=a.goal.x-a.x,dz=a.goal.z-a.z,d=Math.hypot(dx,dz);
   if(d<.4){a.speed=0;a.state=wet?'shelter':a.intent||'graze';if(a.until<this.time)a.until=this.time+5+this.random()*7;}
   else{
    a.speed=a.state==='scatter'?(a.type==='deer'?7:5.5):wet?2.8:a.type==='deer'?1.7:1.3;
    const travel=Math.min(d,a.speed*dt),point=this.dryPoint(a.x+dx/d*travel,a.z+dz/d*travel);
    a.x=point.x;a.z=point.z;a.heading=Math.atan2(dx,dz);a.phase+=dt*a.speed*(a.type==='rabbit'?3.4:2.8);
   }
   a.y=terrainHeight(a.x,a.z);
  }
 }
}
