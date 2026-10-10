const KEY_ACTIONS={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'climb',ArrowUp:'climb',KeyS:'dive',ArrowDown:'dive',Space:'flap',ShiftLeft:'glide',ShiftRight:'glide'};
const isForm=target=>target?.isContentEditable||/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(target?.tagName||'');

// Kept separate from flight physics: native keys and held touch buttons share actions.
export function createFlightInput(document,isActive,onLand,onChirp){
 const keys=new Set(),pointerActions=new Set(),listeners=[];
 function listen(surface,event,fn){if(!surface?.addEventListener)return;surface.addEventListener(event,fn);listeners.push([surface,event,fn]);}
 function clear(){keys.clear();pointerActions.clear();}
 listen(document,'keydown',event=>{
  if(!isActive()||isForm(event.target))return;
  const action=KEY_ACTIONS[event.code];
  if(action){keys.add(event.code);event.preventDefault();}
  if(event.code==='KeyL'&&!event.repeat){event.preventDefault();onLand();}
  if(event.code==='KeyF'&&!event.repeat){event.preventDefault();onChirp();}
 });
 listen(document,'keyup',event=>keys.delete(event.code));
 listen(document.defaultView,'blur',clear);
 listen(document,'focusin',event=>{if(isForm(event.target))clear();});
 function read(){
  if(!isActive()){clear();return {turn:0,pitch:0,flap:false,glide:false};}
  const actions=new Set(pointerActions);for(const key of keys)actions.add(KEY_ACTIONS[key]);
  return {turn:Number(actions.has('right'))-Number(actions.has('left')),pitch:Number(actions.has('climb'))-Number(actions.has('dive')),flap:actions.has('flap'),glide:actions.has('glide')};
 }
 return {read,clear,hold(action,pressed){if(pressed&&isActive())pointerActions.add(action);else pointerActions.delete(action);},dispose(){clear();for(const [surface,event,fn] of listeners)surface.removeEventListener(event,fn);}};
}
