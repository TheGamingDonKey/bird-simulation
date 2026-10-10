// A procedural skydome, sun halo, moon and stars. No downloaded textures.
export function createAtmosphere(THREE, scene, renderer) {
  const uniforms = {sunDirection:{value:new THREE.Vector3()},day:{value:1},dusk:{value:0},storm:{value:0},flash:{value:0}};
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1100,32,20),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,uniforms,
    vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec3 direction; uniform vec3 sunDirection; uniform float day,dusk,storm,flash;
    void main(){vec3 d=normalize(direction);float h=pow(max(d.y,0.0),0.45);
    vec3 top=mix(vec3(0.009,0.017,0.045),vec3(0.09,0.34,0.64),day);
    vec3 horizon=mix(vec3(0.055,0.085,0.14),vec3(0.60,0.79,0.89),day);
    horizon=mix(horizon,vec3(0.88,0.38,0.12),dusk*0.68);
    vec3 col=mix(horizon,top,h);col=mix(col,vec3(0.12,0.16,0.21),storm*0.62);
    float a=max(dot(d,sunDirection),0.0);col+=vec3(1.0,0.53,0.16)*pow(a,24.0)*dusk*0.45;
    col+=vec3(1.0,0.85,0.57)*pow(a,6000.0)*3.0*(1.0-storm*0.8)*smoothstep(-0.02,0.03,sunDirection.y);
    col+=vec3(0.48,0.57,0.75)*flash;gl_FragColor=vec4(col,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }` }));
  sky.renderOrder=-10;scene.add(sky);
  const starPositions=[];let seed=273;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<850;i++){const y=random(),a=random()*Math.PI*2,r=Math.sqrt(1-y*y);starPositions.push(Math.cos(a)*r*1020,y*1020,Math.sin(a)*r*1020);}
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#d9eaff',size:1.6,transparent:true,opacity:0,depthWrite:false,fog:false}));scene.add(stars);
  const moon=new THREE.Mesh(new THREE.SphereGeometry(8,16,12),new THREE.MeshBasicMaterial({color:'#d4e4f5',fog:false}));scene.add(moon);
  const hemi=new THREE.HemisphereLight('#b3d9ed','#344426',1);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff2d7',3);scene.add(sun);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-235,right:235,top:235,bottom:-235,near:1,far:850});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00012;sun.shadow.normalBias=.45;
  const moonLight=new THREE.DirectionalLight('#95b9ef',.1);scene.add(moonLight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  scene.fog=new THREE.FogExp2('#a8c8d0',.0014);
  return {sun,update(hour,weather,camera){
    const angle=(hour-6)/24*Math.PI*2, altitude=Math.sin(angle),day=THREE.MathUtils.smoothstep(altitude,-.10,.45),dusk=Math.max(0,1-Math.abs(altitude)*4);
    const direction=uniforms.sunDirection.value.set(-Math.cos(angle),altitude,-.35).normalize();uniforms.day.value=day;uniforms.dusk.value=dusk;uniforms.storm.value=weather.cloudCover||0;uniforms.flash.value=weather.lightning||0;
    sky.position.copy(camera.position);stars.position.copy(camera.position);stars.material.opacity=(1-day)*(1-(weather.cloudCover||0)*.75);stars.visible=day<.9;
    moon.position.copy(camera.position).addScaledVector(direction,-960);moon.visible=altitude<.04;
    sun.position.copy(direction).multiplyScalar(350);sun.intensity=(Math.max(0,altitude)*3.7+(altitude>0?.25:0))*(1-(weather.cloudCover||0)*.7)+(weather.lightning||0)*5;sun.color.set(dusk>.3?'#ffc684':'#fff2dc');
    hemi.intensity=.15+day*.9*(1-(weather.cloudCover||0)*.3)+(weather.lightning||0)*2;hemi.color.set(day>.4?'#aacce8':'#617caf');moonLight.position.copy(direction).multiplyScalar(-350);moonLight.intensity=(1-day)*.2;
    const local=weather.sample(camera.position.x,camera.position.z);scene.fog.color.set(day>.3?'#b3cbd0':'#172c4a');scene.fog.density=.0011+local.fog*.006+local.rain*.0018;
    renderer.toneMappingExposure=.95+(1-day)*.18;
    return day;
  },quality(level){renderer.shadowMap.enabled=level!=='low';const n=level==='ultra'?2048:1024;if(sun.shadow.mapSize.x!==n){sun.shadow.mapSize.set(n,n);sun.shadow.map?.dispose();sun.shadow.map=null;}renderer.setPixelRatio(Math.min(devicePixelRatio,level==='ultra'?2:level==='low'?1:1.5));}};
}
