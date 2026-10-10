export function setupAudio(button,habitat,isRunning){
let audio,noiseGain,audioOn=false;
button.onclick=async()=>{if(!audio){audio=new AudioContext();const buffer=audio.createBuffer(1,audio.sampleRate*3,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.4;const source=audio.createBufferSource();source.buffer=buffer;source.loop=true;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;noiseGain=audio.createGain();noiseGain.gain.value=0;source.connect(filter).connect(noiseGain).connect(audio.destination);source.start();}await audio.resume();audioOn=!audioOn;noiseGain.gain.setTargetAtTime(audioOn?.1:0,audio.currentTime,.2);button.textContent=audioOn?'Sound on':'Sound off';button.setAttribute('aria-pressed',String(audioOn))};
let lastChirp=0;
function chirp(){if(!audioOn||!isRunning()||habitat.time-lastChirp<2)return;lastChirp=habitat.time;const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(1800,t);o.frequency.exponentialRampToValueAtTime(2900,t+.08);o.frequency.exponentialRampToValueAtTime(1400,t+.2);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.015,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.22);o.connect(g).connect(audio.destination);o.start();o.stop(t+.23)}

return chirp;
}
