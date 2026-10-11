const horizontal = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const validPosition = p => !!p && [p.x,p.y,p.z].every(Number.isFinite);
const villageDistance = p => Math.hypot(p.x-35,p.z-20);

// Short, playable life stages rather than biological time scales. Warmth and
// nourished growth are retained when a parent leaves; hungry chicks wait safely.
export class NestingSimulation {
  constructor(perches=[]) {
    const seen=new Set();
    const anchors=(Array.isArray(perches)?perches:[]).filter(p=>{
      if(!validPosition(p)||!p.id||!['tent','tree'].includes(p.type)||seen.has(p.id))return false;
      seen.add(p.id);return true;
    }).sort((a,b)=>villageDistance(a)-villageDistance(b)||String(a.id).localeCompare(String(b.id)));
    const trees=anchors.filter(p=>p.type==='tree');
    const home=anchors.find(p=>p.type==='tent')||trees[0];
    const nestAnchors=home?[home]:[];
    for(const p of trees) {
      if(nestAnchors.length===3)break;
      if(nestAnchors.every(other=>p.id!==other.id&&horizontal(p,other)>=18))nestAnchors.push(p);
    }
    // Sparse custom habitats still use existing anchors, never invented perches.
    for(const p of trees)if(nestAnchors.length<3&&!nestAnchors.some(other=>other.id===p.id))nestAnchors.push(p);
    this.nests=nestAnchors.map((p,i)=>({
      id:`nest-${i}`,label:i===0?'Home nest':`Tree nest ${i}`,x:p.x,y:p.y,z:p.z,perchId:p.id,claimed:false,
      eggs:[0,1].map(j=>({id:`nest-${i}-egg-${j}`,warmth:0,stage:'egg',age:0,hunger:0,feeds:0})),
    }));
    const foodAnchors=[];
    for(const p of trees) {
      if(foodAnchors.length===3)break;
      if(!nestAnchors.some(other=>other.id===p.id)&&foodAnchors.every(other=>horizontal(p,other)>=20))foodAnchors.push(p);
    }
    for(const p of trees)if(foodAnchors.length<3&&!foodAnchors.some(other=>other.id===p.id))foodAnchors.push(p);
    this.foodSources=foodAnchors.map((p,i)=>({id:`forage-${i}`,label:`Foraging crown ${i+1}`,x:p.x,y:p.y,z:p.z,perchId:p.id,cooldown:0}));
    this.reset();
  }

  reset() {
    this.inventory=0;this.fledged=0;this.time=0;this._actionReady=0;
    for(const nest of this.nests) {
      nest.claimed=false;
      for(const egg of nest.eggs)Object.assign(egg,{warmth:0,stage:'egg',age:0,hunger:0,feeds:0});
    }
    for(const source of this.foodSources)source.cooldown=0;
  }

  nearestNest(player) { return this._nearest(this.nests,player,'nest'); }
  nearestFood(player) { return this._nearest(this.foodSources,player,'source'); }

  _nearest(sites,player,key) {
    if(!validPosition(player))return null;
    let nearest=null;
    for(const site of sites) {
      const horizontalDistance=horizontal(site,player),distance=Math.hypot(horizontalDistance,site.y+.4-player.y);
      if(!nearest||distance<nearest.distance)nearest={[key]:site,distance,horizontalDistance};
    }
    return nearest;
  }

  _perchedNest(player) {
    if(!validPosition(player)||player.mode!=='perched'||!player.perch)return null;
    return this.nests.find(n=>n.perchId===player.perch.id&&horizontal(n,player)<=3&&Math.abs(player.y-n.y-.4)<=2)||null;
  }

  step(dt,player=null) {
    if(!Number.isFinite(dt)||dt<=0)return;
    // Resume after a background tab without granting minutes of instant growth.
    const duration=Math.min(dt,.25),steps=Math.ceil(duration/.05),slice=duration/steps;
    const brooding=this._perchedNest(player);
    for(let i=0;i<steps;i++) {
      this.time+=slice;
      for(const source of this.foodSources)source.cooldown=Math.max(0,source.cooldown-slice);
      for(const nest of this.nests)for(const egg of nest.eggs) {
        if(egg.stage==='egg') {
          if(nest.claimed&&nest===brooding) {
            egg.warmth=Math.min(12,egg.warmth+slice);
            if(egg.warmth>=12-1e-9)Object.assign(egg,{warmth:12,stage:'chick',age:0,hunger:.65,feeds:0});
          }
        } else if(egg.stage==='chick') {
          egg.hunger=Math.min(1,egg.hunger+slice*.065);
          if(egg.feeds>0&&egg.hunger<=.6)egg.age=Math.min(24,egg.age+slice);
          if(egg.age>=24-1e-9&&egg.feeds>=2) {egg.age=24;egg.stage='fledged';this.fledged++;}
        }
      }
    }
  }

  guidance(player) {
    const nearNest=this.nearestNest(player),nearFood=this.nearestFood(player);
    const nest=this._perchedNest(player),source=nearFood?.source||null;
    const result=(ok,message,action)=>({ok,message,action,nest:nest||nearNest?.nest||null,source});
    if(!validPosition(player))return result(false,'Take control of your bird to tend a nest.','travel');
    if(nest) {
      if(!nest.claimed)return result(true,`Claim ${nest.label.toLowerCase()} and settle over its eggs.`,'claim');
      const hungry=nest.eggs.some(egg=>egg.stage==='chick'&&egg.hunger>=.35);
      if(hungry)return this.inventory>0?result(true,'Feed a hungry chick with one carried meal.','feed'):result(false,'Chicks are hungry. Visit a foraging crown, collect food, then return.','forage');
      if(nest.eggs.some(egg=>egg.stage==='egg'))return result(true,'Stay perched here to warm the eggs.','brood');
      if(nest.eggs.some(egg=>egg.stage==='chick'))return result(false,'Chicks are growing with full bellies. Gather another meal for later.','wait');
      return result(false,'Your young birds have fledged. Visit another nest to raise its family.','complete');
    }
    if(nearFood&&nearFood.horizontalDistance<=8&&Math.abs(player.y-source.y)<=6) {
      if(this.inventory>=3)return result(false,'You are carrying three meals. Return to a hungry nest.','return');
      if(source.cooldown>1e-8)return result(false,`This crown is regrowing food. Ready in ${Math.ceil(source.cooldown)} seconds.`,'wait');
      return result(true,'Collect a meal from this foraging crown.','collect');
    }
    if(nearNest&&nearNest.horizontalDistance<=16)return result(false,'Land on the nest perch to claim it, brood eggs or feed chicks.','land');
    return result(false,this.inventory?'Return to a nest and land to feed its chicks.':'Fly to a marked crown to collect food, or land at a nest.','travel');
  }

  action(player) {
    const context=this.guidance(player);
    if(!context.ok)return {ok:false,message:context.message};
    if(this.time<this._actionReady-1e-9)return {ok:false,message:'Give your bird a moment before the next interaction.'};
    if(context.action==='claim')context.nest.claimed=true;
    else if(context.action==='feed') {
      const chick=context.nest.eggs.filter(egg=>egg.stage==='chick'&&egg.hunger>=.35).sort((a,b)=>b.hunger-a.hunger||a.feeds-b.feeds)[0];
      this.inventory--;chick.hunger=0;chick.feeds++;
    } else if(context.action==='collect') {this.inventory++;context.source.cooldown=5;}
    else if(context.action!=='brood')return {ok:false,message:context.message};
    this._actionReady=this.time+.8;
    const message=context.action==='claim'?`Claimed ${context.nest.label.toLowerCase()}. Stay perched to incubate two eggs.`
      :context.action==='feed'?'Chick fed. Its growth continues while nourished.'
      :context.action==='collect'?`Food collected. Carrying ${this.inventory} of 3 meals.`:context.message;
    return {ok:true,message};
  }
}
