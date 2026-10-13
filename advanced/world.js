import { terrainHeight, riverX } from './terrain.js';
import { VillageSimulation, villageTents } from './villagers.js';
import { WildlifeSimulation } from './wildlife.js';

// All scenery is made locally. A seeded stream keeps the valley identical on reload.
export function createWorld(THREE, scene) {
  let seed = 928401;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const root = new THREE.Group(); root.name = 'Living valley'; scene.add(root);
  const villageCenter = { x: 35, z: 20 };
  const perches=[];
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, ...extra });
  const mesh = (geometry, material, parent = root) => { const m = new THREE.Mesh(geometry, material); m.castShadow = m.receiveShadow = !material.transparent; parent.add(m); return m; };
  const dummy = new THREE.Object3D();
  const green = new THREE.Color();
  const soil = [0x84a875, 0x91b17c, 0xa0ba85, 0x8eaa79, 0x7d9f74].map(c => new THREE.Color(c));
  const stoneColors = [0x889799, 0x98a5a1, 0xa5afa5, 0x7d9290].map(c => new THREE.Color(c));

  // Independent triangles give the terrain its quiet, hand cut facets.
  const positions = [], colors = [];
  const steps = 105, span = 570;
  function terrainVertex(x, z, color) { positions.push(x, terrainHeight(x, z), z); colors.push(color.r, color.g, color.b); }
  for (let zi = 0; zi < steps; zi++) for (let xi = 0; xi < steps; xi++) {
    const x = -span / 2 + xi * span / steps, z = -span / 2 + zi * span / steps, s = span / steps;
    const height = terrainHeight(x + s / 2, z + s / 2);
    const c = (height > 32 ? stoneColors : soil)[Math.floor(rand() * (height > 32 ? stoneColors.length : soil.length))].clone();
    const meadow = Math.sin(x * .063 + Math.sin(z * .031) * 2) * Math.cos(z * .058);
    c.lerp(new THREE.Color(meadow > 0 ? 0xb7bd78 : 0x658b65), Math.abs(meadow) * .24);
    if (Math.abs(x - riverX(z)) < 19) c.lerp(new THREE.Color(0xaabc91), 0.36);
    if (height > 52 && x < -75) c.lerp(new THREE.Color(0xd7ddd4), 0.7);
    terrainVertex(x, z, c); terrainVertex(x, z + s, c); terrainVertex(x + s, z, c);
    c.multiplyScalar(0.98 + rand() * 0.04);
    terrainVertex(x + s, z, c); terrainVertex(x, z + s, c); terrainVertex(x + s, z + s, c);
  }
  const landGeometry = new THREE.BufferGeometry();
  landGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  landGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  landGeometry.computeVertexNormals();
  const groundMaterial = mat(0xffffff, { vertexColors: true });
  groundMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 meadowPosition;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nmeadowPosition=position.xz;');
    shader.fragmentShader = 'varying vec2 meadowPosition;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat meadowGrain=sin(meadowPosition.x*2.3+sin(meadowPosition.y*1.7))*sin(meadowPosition.y*3.1);\ndiffuseColor.rgb*=.975+meadowGrain*.032;');
  };
  const land = mesh(landGeometry, groundMaterial); land.name = 'Valley terrain'; land.castShadow=false;

  // A continuous river ribbon, with a thinner pale strand suggesting moving light.
  function ribbon(points, widths, material) {
    const p = [], uv = [], ind = [];
    points.forEach((v, i) => {
      const prev = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
      const dx = next.x - prev.x, dz = next.z - prev.z, len = Math.hypot(dx, dz) || 1;
      const nx = dz / len, nz = -dx / len, w = widths[i] / 2;
      p.push(v.x - nx * w, v.y, v.z - nz * w, v.x + nx * w, v.y, v.z + nz * w);
      uv.push(0, i / points.length, 1, i / points.length);
      if (i) { const j = i * 2; ind.push(j - 2, j - 1, j, j - 1, j + 1, j); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ind); g.computeVertexNormals();
    return mesh(g, material);
  }
  const riverPoints = Array.from({ length: 225 }, (_, i) => { const z = -285 + i * 570 / 224; return { x: riverX(z), y: -2.5, z }; });
  const waterMaterial = mat(0x669fa6, { metalness: 0.28, roughness: 0.32, transparent: true, opacity: 0.86, side: THREE.DoubleSide });
  const waterTime={value:0};
  waterMaterial.onBeforeCompile=shader=>{
    shader.uniforms.waterTime=waterTime;
    shader.vertexShader='varying vec2 riverSurface;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nriverSurface=position.xz;');
    shader.fragmentShader='uniform float waterTime; varying vec2 riverSurface;\n'+shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nfloat riverWave=sin(riverSurface.y*1.1-waterTime*2.1+sin(riverSurface.x*.7));\nfloat crossWave=cos(riverSurface.x*2.3+riverSurface.y*.4-waterTime*1.3);\nnormal=normalize(normal+vec3(crossWave*.055,riverWave*.025,riverWave*.065));');
  };
  const river=ribbon(riverPoints, riverPoints.map((p, i) => 20 + 1.4 * Math.sin(i * 0.17)), waterMaterial);river.name='Continuous river';river.receiveShadow=true;
  const glintMaterial = new THREE.MeshBasicMaterial({ color: 0xc5e4d9, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  ribbon(riverPoints.map(p => ({ x: p.x + 2.6, y: p.y + 0.035, z: p.z })), riverPoints.map((p, i) => 0.45 + 0.3 * Math.sin(i * 0.15) ** 2), glintMaterial);
  const ripples = new THREE.Group(); root.add(ripples);
  const rippleGeo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 64; i++) {
    const z = -190 + rand() * 380; const r = mesh(rippleGeo, glintMaterial, ripples);
    r.rotation.x = -Math.PI / 2; r.position.set(riverX(z) + (rand() - 0.5) * 12, -2.42, z);
    r.scale.set(0.8 + rand() * 2.5, 0.12 + rand() * 0.2, 1); r.userData.phase = rand() * 6.28;
  }

  // Jagged outer ridges frame the open sky and the central bird corridor.
  const mountainGeo = new THREE.ConeGeometry(1, 1, 5, 1);
  const mountainMats = [mat(0x819496), mat(0x91a2a0), mat(0xa1aaa2), mat(0x789392)];
  for (let i = 0; i < 23; i++) {
    const a = i / 23 * Math.PI * 2, radius = 205 + rand() * 25;
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    const h = 34 + rand() * 58, w = 26 + rand() * 22;
    const m = mesh(mountainGeo, mountainMats[i % mountainMats.length]);
    m.position.set(x, terrainHeight(x, z) + h * 0.32, z); m.scale.set(w, h, w * (0.7 + rand() * 0.4)); m.rotation.y = rand() * 6.28;
    if (x < -85 || z < -160) {
      const cap = mesh(mountainGeo, mat(0xd9dfd4));
      cap.position.set(x, m.position.y + h * 0.345, z); cap.scale.set(w * 0.32, h * 0.32, m.scale.z * 0.32); cap.rotation.y = m.rotation.y;
    }
  }
  const ridgeRocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),mat(0x899995),96);ridgeRocks.name='Broken ridge outcrops';root.add(ridgeRocks);
  for(let i=0;i<96;i++){
    const a=Math.floor(i/8)/12*Math.PI*2+(rand()-.5)*.19,r=190+rand()*53,x=Math.cos(a)*r,z=Math.sin(a)*r,s=3+rand()*8;
    instance(ridgeRocks,i,x,terrainHeight(x,z)+s*.23,z,s*(.65+rand()*.65),s*(.35+rand()*.7),s*(.7+rand()*.5),rand()*Math.PI*2);
  }
  ridgeRocks.castShadow=ridgeRocks.receiveShadow=true;

  const trunkGeo = new THREE.CylinderGeometry(0.34, 0.48, 1, 5);
  const coniferGeo = new THREE.ConeGeometry(1, 1, 6);
  const canopyGeo = new THREE.IcosahedronGeometry(1, 0);
  const canopyVertices=canopyGeo.attributes.position;let crownVertex=0;
  for(let i=1;i<canopyVertices.count;i++)if(canopyVertices.getY(i)>canopyVertices.getY(crownVertex))crownVertex=i;
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x685541), 760);
  const needles = new THREE.InstancedMesh(coniferGeo, mat(0x45694f), 1380);
  const leaves = new THREE.InstancedMesh(canopyGeo, mat(0x6c8b53), 520);
  root.add(trunks, needles, leaves);
  let trunkCount = 0, needleCount = 0, leafCount = 0;
  function instance(inst, index, x, y, z, sx, sy, sz, rotation = 0, color) {
    dummy.position.set(x, y, z); dummy.rotation.set(0, rotation, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); inst.setMatrixAt(index, dummy.matrix);
    if (color) inst.setColorAt(index, color);
  }
  for (let attempt = 0; attempt < 1700 && trunkCount < 760; attempt++) {
    const x = (rand() - 0.5) * 380, z = (rand() - 0.5) * 380;
    const riverDist = Math.abs(x - riverX(z));
    if (riverDist < 19 || Math.hypot(x - 35, z - 20) < 30 || terrainHeight(x, z) > 51) continue;
    // Meadow opens toward the front; thicker forest lies along either valley wall.
    if (Math.abs(x) < 58 && z > -100 && rand() > 0.25) continue;
    const y = terrainHeight(x, z), h = 4.5 + rand() * 7.8, w = 1.7 + rand() * 1.6, rotation = rand() * 6.28;
    instance(trunks, trunkCount++, x, y + h * 0.23, z, 1, h * 0.47, 1, rotation);
    if ((Math.abs(x) > 75 || z < -65 || rand() < 0.4) && needleCount < 1378) {
      green.setHSL(0.35 + rand() * 0.07, 0.2 + rand() * 0.15, 0.22 + rand() * 0.12);
      instance(needles, needleCount++, x, y + h * 0.58, z, w, h * 0.76, w, rotation, green);
      instance(needles, needleCount++, x, y + h * 0.78, z, w * 0.73, h * 0.53, w * 0.73, rotation, green);
      perches.push({id:`tree-${perches.length}`,type:'tree',x,y:y+h*1.045,z,radius:.7,label:'Conifer crown',source:'Wind bent conifers',instance:needleCount-1});
    } else if (leafCount < 520) {
      green.setHSL(0.22 + rand() * 0.13, 0.25 + rand() * 0.18, 0.35 + rand() * 0.13);
      instance(leaves, leafCount++, x, y + h * 0.72, z, w * 1.35, h * 0.43, w * 1.2, rotation, green);
      const ox=canopyVertices.getX(crownVertex)*w*1.35,oz=canopyVertices.getZ(crownVertex)*w*1.2;perches.push({id:`tree-${perches.length}`,type:'tree',x:x+ox*Math.cos(rotation)+oz*Math.sin(rotation),y:y+h*.72+canopyVertices.getY(crownVertex)*h*.43,z:z-ox*Math.sin(rotation)+oz*Math.cos(rotation),radius:1.1,label:'Broadleaf crown',source:'Meadow tree crowns',instance:leafCount-1});
    }
  }
  trunks.count = trunkCount; needles.count = needleCount; leaves.count = leafCount;
  trunks.castShadow = needles.castShadow = leaves.castShadow = true;
  trunks.receiveShadow = needles.receiveShadow = leaves.receiveShadow = true;
  const breezeUniforms = {valleyTime: {value: 0}, valleyBreeze: {value: .3}};
  const swayShader = shader => {
    Object.assign(shader.uniforms, breezeUniforms);
    shader.vertexShader = 'uniform float valleyTime; uniform float valleyBreeze;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat treePhase=instanceMatrix[3].x*.11+instanceMatrix[3].z*.08;\ntransformed.x+=sin(valleyTime*1.25+treePhase)*pow(max(position.y+.5,0.),2.)*.065*valleyBreeze;\ntransformed.z+=cos(valleyTime*.9+treePhase)*pow(max(position.y+.5,0.),2.)*.035*valleyBreeze;');
  };
  for (const tree of [needles, leaves]) {
    tree.material.onBeforeCompile = swayShader;
    tree.customDepthMaterial = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking});
    tree.customDepthMaterial.onBeforeCompile = swayShader;
  }
  trunks.name = 'Forest trunks'; needles.name = 'Wind bent conifers'; leaves.name = 'Meadow tree crowns';

  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat(0x9a9b88), 240); root.add(rocks);
  for (let i = 0; i < 240; i++) {
    const z = (rand() - 0.5) * 400, x = i < 135 ? riverX(z) + (rand() > 0.5 ? 1 : -1) * (11 + rand() * 8) : (rand() - 0.5) * 380;
    const s = 0.5 + rand() * 2.0;
    instance(rocks, i, x, terrainHeight(x, z) + s * 0.24, z, s, s * 0.55, s * 0.85, rand() * 6.28);
  }
  const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.11, 2.5, 3), mat(0x999767), 440); reeds.name='River reeds';root.add(reeds);
  for (let i = 0; i < 440; i++) {
    const z = (rand() - 0.5) * 390, x = riverX(z) + (rand() > 0.5 ? 1 : -1) * (10.5 + rand() * 4);
    instance(reeds, i, x, terrainHeight(x, z) + 0.8, z, 1, 0.6 + rand() * 0.55, 1, rand() * 6.28);
  }

  // Low clustered detail reads as a meadow, without thousands of separate draw calls.
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(.09, .7, 3), mat(0x7a9858), 1900);
  const flowerStems = new THREE.InstancedMesh(new THREE.CylinderGeometry(.035, .04, .48, 3), mat(0x68814d), 540);
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.17, 0), mat(0xffffff), 540);
  root.add(grass, flowerStems, flowers); grass.name = 'Meadow grass'; flowers.name = 'Wildflower patches';flowerStems.name='Wildflower stems';
  let grassCount = 0, flowerCount = 0;
  for (let patch = 0; patch < 90; patch++) {
    const px = (rand() - .5) * 280, pz = (rand() - .5) * 300;
    if (Math.abs(px - riverX(pz)) < 19 || Math.hypot(px - 35, pz - 20) < 23 || terrainHeight(px, pz) > 26) continue;
    for (let j = 0; j < 32 && grassCount < 1900; j++) {
      const x = px + (rand() - .5) * 13, z = pz + (rand() - .5) * 13;
      if (Math.abs(x - riverX(z)) < 18) continue;
      const scale = .5 + rand() * .9;
      instance(grass, grassCount++, x, terrainHeight(x, z) + scale * .3, z, 1, scale, 1, rand() * 6.28);
      if (j < 9 && flowerCount < 540) {
        const y = terrainHeight(x, z);
        instance(flowerStems, flowerCount, x, y + .22, z, 1, 1, 1);
        green.setHex([0xe9d799, 0xf4e7ca, 0xc5a5a2][patch % 3]);
        instance(flowers, flowerCount++, x, y + .51, z, 1, .55, 1, rand() * 6.28, green);
      }
    }
  }
  grass.count = grassCount; flowerStems.count = flowers.count = flowerCount;
  for (const detail of [rocks, reeds, grass, flowerStems, flowers]) detail.receiveShadow = true;
  rocks.castShadow=flowers.castShadow=true;

  const pathMaterial = mat(0xb6ab83, { side: THREE.DoubleSide });
  const tents = [], tentSites = villageTents(), tentFlaps = [];
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ddcfaa'; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1100; i++) { ctx.fillStyle = `rgba(110,93,66,${rand() * 0.12})`; ctx.fillRect(rand() * 128, rand() * 128, 1, 8); }
  ctx.strokeStyle = 'rgba(109,88,57,.28)'; ctx.lineWidth = 1; for (let i = 0; i < 128; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke(); }
  const fabric = new THREE.CanvasTexture(canvas); fabric.colorSpace = THREE.SRGBColorSpace;
  const tentMaterial = mat(0xf2dfb8, { map: fabric, side: THREE.DoubleSide });
  const timberMaterial = mat(0x6c5038);
  const unitPole = new THREE.CylinderGeometry(0.1, 0.13, 1, 5);
  function pole(parent, a, b, radius = 1) {
    const v = new THREE.Vector3().subVectors(b, a); const p = mesh(unitPole, timberMaterial, parent);
    p.position.copy(a).add(b).multiplyScalar(0.5); p.scale.set(radius, v.length(), radius); p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); return p;
  }
  for (let i = 0; i < 6; i++) {
    const {x, z, rotation} = tentSites[i];
    const tent = new THREE.Group(); tent.name = `Canvas shelter ${i + 1}`; tent.position.set(x, terrainHeight(x, z) + 0.15, z); tent.rotation.y = rotation; root.add(tent); tents.push(tent);
    perches.push({id:`tent-${i}`,type:'tent',x,y:tent.position.y+4.15,z,radius:.7,label:`Shelter ${i+1} ridge`,source:tent.name});
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-3,0,-3.8, 0,4.1,-3.8, -3,0,3.8, 0,4.1,-3.8,0,4.1,3.8,-3,0,3.8, 0,4.1,-3.8,3,0,-3.8,0,4.1,3.8, 3,0,-3.8,3,0,3.8,0,4.1,3.8, -3,0,-3.8,3,0,-3.8,0,4.1,-3.8],3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,0,1,1,0,1,0,0,1,0,0,1,1,0,1,1,0,1,0,0,1,0,.5,1],2)); g.computeVertexNormals();
    const cloth = mesh(g, tentMaterial, tent); cloth.castShadow = true;
    pole(tent, new THREE.Vector3(0,0,-4), new THREE.Vector3(0,4.5,-4)); pole(tent,new THREE.Vector3(0,0,4),new THREE.Vector3(0,4.5,4)); pole(tent,new THREE.Vector3(0,4.15,-4.1),new THREE.Vector3(0,4.15,4.1));
    const entrance = mesh(new THREE.PlaneGeometry(3.0, 2.3), mat(0x534637, { side: THREE.DoubleSide }), tent); entrance.position.set(0,1.15,-3.72);
    for (const side of [-1, 1]) {
      const flapPivot = new THREE.Group(); tent.add(flapPivot); flapPivot.position.set(side * 1.8, 1.25, 3.81);
      const flap = mesh(new THREE.PlaneGeometry(.65, 2.5, 1, 3), tentMaterial, flapPivot); flap.position.x = -side * .25;
      flapPivot.rotation.y = side * .4; tentFlaps.push({pivot: flapPivot, side, phase: i * 1.7});
    }
    const points = Array.from({length: 14}, (_, j) => { const t = j / 13; const px = 35 + (x - 35) * t, pz = 20 + (z - 20) * t; return {x:px,y:terrainHeight(px,pz)+0.055,z:pz}; });
    ribbon(points, points.map(() => 2.5), pathMaterial);
  }
  const riversidePath = Array.from({length:50},(_,i)=>{const z=-64+i*2.5,x=riverX(z)+23;return{x,y:terrainHeight(x,z)+.07,z};});
  ribbon(riversidePath,riversidePath.map(()=>2),pathMaterial);

  // People have actual articulated arms and legs, and small paths to follow.
  const village = new VillageSimulation({tents: tentSites});
  const people = [], skin = mat(0xad805b), hair = mat(0x403831);
  const limbGeometry = new THREE.CylinderGeometry(0.14, 0.12, 0.85, 5), headGeometry = new THREE.SphereGeometry(0.29, 6, 5);
  for (let i = 0; i < 10; i++) {
    const person = new THREE.Group(); person.name = `Villager ${i + 1}`; person.userData.villagerId = i; root.add(person); const clothes = mat([0x8e7357,0xbca981,0x8c9370,0x986e4f][i%4]);
    const body = mesh(new THREE.CylinderGeometry(0.32,0.4,0.9,5), clothes, person); body.position.y=1.4;
    const head=mesh(headGeometry,skin,person);head.position.y=2.09;
    const cap=mesh(new THREE.SphereGeometry(.29,6,4,0,Math.PI*2,0,Math.PI*.5),hair,head);cap.position.y=.07;
    const limbs=[];
    for(let j=0;j<4;j++){const pivot=new THREE.Group();person.add(pivot);const arm=j<2;pivot.position.set((j%2?1:-1)*(arm?.42:.18),arm?1.78:.99,0);const m=mesh(limbGeometry,arm?skin:clothes,pivot);m.position.y=-.43;limbs.push(pivot);}
    people.push({person,limbs,body,head});
  }

  const fireY=terrainHeight(35,20)+.3;
  const fireRing=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.65,0),mat(0x787967),12);root.add(fireRing);
  fireRing.castShadow = fireRing.receiveShadow = true;
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;instance(fireRing,i,35+Math.cos(a)*2,fireY,20+Math.sin(a)*2,1,.6,1,a);}
  for(let i=0;i<5;i++){const log=mesh(new THREE.CylinderGeometry(.22,.28,3.3,6),timberMaterial);log.position.set(35,fireY+.2,20);log.rotation.set(Math.PI/2,0,i*Math.PI/5);}
  const fireMaterial=new THREE.MeshBasicMaterial({color:0xffa538,transparent:true,opacity:.85,depthWrite:false});
  const flames=[];
  for(let i=0;i<7;i++){const f=mesh(new THREE.ConeGeometry(.6,2.7,5),fireMaterial);f.position.set(35+(rand()-.5)*1.2,fireY+1.2,20+(rand()-.5)*1.2);flames.push(f);}
  const fireLight=new THREE.PointLight(0xffad53,35,29,2);fireLight.position.set(35,fireY+2,20);root.add(fireLight);

  function softTexture() {
    const c=document.createElement('canvas');c.width=c.height=64;const cc=c.getContext('2d');const grad=cc.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,255,255,.7)');grad.addColorStop(.45,'rgba(255,255,255,.3)');grad.addColorStop(1,'rgba(255,255,255,0)');cc.fillStyle=grad;cc.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);
  }
  const soft=softTexture(), smoke=[];
  const smokeMaterial=new THREE.SpriteMaterial({map:soft,color:0xc7c5b6,transparent:true,opacity:.25,depthWrite:false});
  for(let i=0;i<22;i++){const s=new THREE.Sprite(smokeMaterial.clone());root.add(s);smoke.push(s);}
  const sparksGeometry=new THREE.BufferGeometry(), sparkPositions=new Float32Array(60*3);
  sparksGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));
  const sparks=new THREE.Points(sparksGeometry,new THREE.PointsMaterial({color:0xffc466,size:.16,transparent:true,opacity:.8,depthWrite:false}));root.add(sparks);

  // Nine instanced batches cover all wildlife, including articulated deer legs.
  const wildlifeSimulation=new WildlifeSimulation({groves:perches.filter(p=>p.type==='tree')});
  const animalBodyGeo=new THREE.IcosahedronGeometry(1,0),animalLegGeo=new THREE.CylinderGeometry(.075,.095,1,4);
  const deerMaterial=mat(0x94704e),rabbitMaterial=mat(0xb6a28a),antlerMaterial=mat(0xccc0a0,{side:THREE.DoubleSide}),fishMaterial=mat(0x93b8ad,{metalness:.3,roughness:.35});
  const animalBatch=(name,geometry,material,count)=>{const m=new THREE.InstancedMesh(geometry,material,count);m.name=name;m.castShadow=m.receiveShadow=true;m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(m);return m;};
  const deerBodies=animalBatch('Deer bodies',animalBodyGeo,deerMaterial,8),deerHeads=animalBatch('Deer heads',animalBodyGeo,deerMaterial,8),deerLegs=animalBatch('Deer legs',animalLegGeo,deerMaterial,32);
  const antlerGeo=new THREE.BufferGeometry();antlerGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.04,0,0,-.08,.8,0,.04,0,0,-.08,.5,0,-.4,.88,0,-.04,.67,0,-.08,.7,0,.13,1.06,0,-.04,.87,0],3));antlerGeo.computeVertexNormals();
  const deerAntlers=animalBatch('Deer antlers',antlerGeo,antlerMaterial,16),rabbitBodies=animalBatch('Rabbit bodies',animalBodyGeo,rabbitMaterial,12),rabbitEars=animalBatch('Rabbit ears',animalBodyGeo,rabbitMaterial,24);
  const rabbitTails=animalBatch('Rabbit tails',animalBodyGeo,mat(0xd7c7ac),12),fishBodies=animalBatch('River fish',animalBodyGeo,fishMaterial,14);
  const fishTailGeo=new THREE.BufferGeometry();fishTailGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.25,0,-.45,.25,0,-.45],3));fishTailGeo.computeVertexNormals();
  const fishTails=animalBatch('Fish fins',fishTailGeo,fishMaterial,14);fishBodies.castShadow=fishTails.castShadow=false;
  const animalRoot=new THREE.Object3D(),animalPart=new THREE.Object3D(),animalMatrix=new THREE.Matrix4();
  function animalPartAt(batch,index,x,y,z,sx,sy,sz,rx=0,rz=0){animalPart.position.set(x,y,z);animalPart.scale.set(sx,sy,sz);animalPart.rotation.set(rx,0,rz);animalPart.updateMatrix();animalMatrix.multiplyMatrices(animalRoot.matrix,animalPart.matrix);batch.setMatrixAt(index,animalMatrix);}
  function animateWildlife(){
    let di=0,ri=0,fi=0;
    for(const a of wildlifeSimulation.animals){
      const hop=a.type==='rabbit'&&a.speed>0?Math.max(0,Math.sin(a.phase))*.42:0;
      animalRoot.position.set(a.x,a.y+hop,a.z);animalRoot.rotation.set(0,a.heading,0);animalRoot.updateMatrix();
      if(a.type==='deer'){
        const grazing=a.state==='graze'||a.state==='drink',dip=grazing?.45:0;
        animalPartAt(deerBodies,di,0,1.38,0,.55,.63,1.02);animalPartAt(deerHeads,di,0,2.15-dip,.84,.32,.38,.48,grazing?.65:-.08);
        for(let j=0;j<4;j++)animalPartAt(deerLegs,di*4+j,(j%2?1:-1)*.34,.65,(j<2?1:-1)*.62,1,1.28,1,a.speed>0?Math.sin(a.phase+(j%2?Math.PI:0)+(j<2?0:Math.PI))*.45:0);
        for(let j=0;j<2;j++)animalPartAt(deerAntlers,di*2+j,(j?1:-1)*.22,2.42-dip,.84,.8,.8,.8,grazing?.65:0,(j?1:-1)*.24);
        di++;
      }else if(a.type==='rabbit'){
        animalPartAt(rabbitBodies,ri,0,.36,0,.32,.37,.54,a.speed>0?Math.sin(a.phase)*.12:0);
        for(let j=0;j<2;j++)animalPartAt(rabbitEars,ri*2+j,(j?1:-1)*.13,.87,.3,.09,.4,.11,a.state==='scatter'?-.55:-.13,(j?1:-1)*.14);
        animalPartAt(rabbitTails,ri,0,.38,-.45,.15,.16,.15);ri++;
      }else{
        animalPartAt(fishBodies,fi,0,0,0,.16,.11,.56);animalPartAt(fishTails,fi,0,0,-.44,1,1,1,0,Math.sin(a.phase)*.3);fi++;
      }
    }
    for(const m of [deerBodies,deerHeads,deerLegs,deerAntlers,rabbitBodies,rabbitEars,rabbitTails,fishBodies,fishTails])m.instanceMatrix.needsUpdate=true;
  }

  // High, thin ivory banks stay behind the flock. Unlit color avoids stone-like dark facets.
  const cloudMaterial=new THREE.MeshBasicMaterial({color:0xf2f1e6,transparent:true,opacity:.48,depthWrite:false});
  const clouds=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),cloudMaterial,48);root.add(clouds);
  clouds.name='Drifting cloud banks';clouds.frustumCulled=false;
  const cloudFade=new THREE.InstancedBufferAttribute(new Float32Array(48).fill(1),1);
  clouds.geometry.setAttribute('cloudFade',cloudFade);
  cloudMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float cloudFade;\nvarying float vCloudFade;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCloudFade = cloudFade;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCloudFade;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vCloudFade;');
  };
  cloudMaterial.customProgramCacheKey=()=> 'drifting-cloud-fade-v1';
  const cloudData=[],cloudBanks=[];
  for(let bank=0;bank<12;bank++){
    const x=(rand()-.5)*400,z=-185+rand()*195,y=106+rand()*29;
    cloudBanks.push({x,z,initialX:x,initialZ:z});
    for(let j=0;j<4;j++){cloudData.push({bank,x:(rand()-.5)*23,y:y+rand()*2,z:(rand()-.5)*10,sx:5+rand()*6,sy:1.5+rand()*1.7,sz:4+rand()*4,phase:rand()*6.28});}
  }
  const haze=[];
  for(let i=0;i<22;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:soft,color:0xd9e0d8,opacity:.065,transparent:true,depthWrite:false}));s.position.set((rand()-.5)*130,6+rand()*9,(rand()-.5)*300);s.scale.set(72+rand()*70,13+rand()*10,1);root.add(s);haze.push({sprite:s,x:s.position.x,z:s.position.z,phase:rand()*6.28});}

  const rainCount=1050, rainPositions=new Float32Array(rainCount*6), rainSeeds=[];
  for(let i=0;i<rainCount;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand());rainSeeds.push({x:Math.cos(a)*r,z:Math.sin(a)*r,y:rand()*64,phase:rand()*25});}
  const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:0xc3d5d6,transparent:true,opacity:.22,depthWrite:false}));root.add(rain);
  rain.name='Moving rain curtain'; rain.frustumCulled=false;
  const snowCount=500,snowPositions=new Float32Array(snowCount*3),snowSeeds=[];
  for(let i=0;i<snowCount;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand());snowSeeds.push({x:Math.cos(a)*r,z:Math.sin(a)*r,y:rand()*65,phase:rand()*6.28});}
  const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.BufferAttribute(snowPositions,3));
  const snow=new THREE.Points(snowGeometry,new THREE.PointsMaterial({color:0xf4f3e8,size:.35,transparent:true,opacity:.72,depthWrite:false}));root.add(snow);
  snow.name='Moving snow flurries'; snow.frustumCulled=false;
  // The rain front has its own dark bank and cool curtain at the eastern tree line.
  const front=new THREE.Group();root.add(front);
  const frontMaterial=new THREE.MeshBasicMaterial({color:0xc7d5d3,transparent:true,opacity:.45,depthWrite:false});
  for(let i=0;i<7;i++){const c=mesh(new THREE.IcosahedronGeometry(1,2),frontMaterial,front);c.position.set(70+i*14,96+Math.sin(i)*2,-32+Math.cos(i*.8)*9);c.scale.set(12,3.3,9);}
  const lightningMaterial=new THREE.MeshBasicMaterial({color:0xebf1e3,transparent:true,opacity:0,depthWrite:false});
  const lightning=mesh(new THREE.CylinderGeometry(.25,.4,48,4),lightningMaterial);lightning.position.set(121,35,-8);

  let lastTime = 0;
  function animate(time, options={},dt=0) {
    const mode=options.weather||'mixed';
    const wind=options.wind; const wx=typeof wind==='number'?wind:(wind?.x??3), wz=typeof wind==='object'?(wind?.z??0):0;
    const daylight=options.daylight??1;
    waterTime.value=time;
    const storm=mode==='storm', rainy=storm||mode==='rain';
    const foggy=mode==='fog';
    const clear=mode==='clear';
    const activeFronts=options.weatherSystem?.fronts ?? options.fronts;
    const rainFronts=activeFronts ? activeFronts.filter(f=>(f.type==='rain'||f.type==='storm')&&f.intensity>.02)
      : (rainy||mode==='mixed'?[{x:rainy?52:112,z:rainy?20:0,radius:rainy?95:64,intensity:storm?1:.7}]:[]);
    const snowFronts=activeFronts ? activeFronts.filter(f=>f.type==='snow'&&f.intensity>.02)
      : (mode==='snow'||mode==='mixed'?[{x:mode==='snow'?38:-132,z:mode==='snow'?20:-12,radius:mode==='snow'?110:66,intensity:.8}]:[]);
    rain.visible=rainFronts.length>0;snow.visible=snowFronts.length>0;
    rain.material.opacity=(storm?.55:rainy?.38:.3)*Math.min(1,Math.max(0,...rainFronts.map(f=>f.intensity))*1.25);
    snow.material.opacity=(mode==='snow'?.9:.68)*Math.min(1,Math.max(0,...snowFronts.map(f=>f.intensity))*1.25);
    frontMaterial.opacity=storm?.68:clear?.24:.45;
    frontMaterial.color.setHex(storm?0x91a6ad:0xc7d5d3);
    cloudMaterial.opacity=clear?.38:storm?.61:.48;
    cloudMaterial.color.setHex(storm?0xc3d1d2:0xf2f1e6);
    breezeUniforms.valleyTime.value=time; breezeUniforms.valleyBreeze.value=Math.min(2.4,.2+Math.hypot(wx,wz)*.12);
    for(const flap of tentFlaps)flap.pivot.rotation.y=flap.side*(.4+Math.sin(time*3.7+flap.phase)*.16*breezeUniforms.valleyBreeze.value);
    // Integrate the current wind; multiplying it by total time retroactively moves clouds on every gust.
    // Recycle entire banks beyond the valley, after they have completely faded out.
    for(const bank of cloudBanks){
      bank.x=((bank.x+wx*.12*dt+320)%640+640)%640-320;
      bank.z=((bank.z+wz*.12*dt+320)%640+640)%640-320;
      const edge=Math.max(Math.abs(bank.x),Math.abs(bank.z));
      const t=Math.max(0,Math.min(1,(edge-250)/50));bank.fade=1-t*t*(3-2*t);
    }
    for(let i=0;i<cloudData.length;i++){
      const c=cloudData[i],bank=cloudBanks[c.bank];
      instance(clouds,i,bank.x+c.x,c.y+Math.sin(time*.035+c.phase)*1.1,bank.z+c.z,c.sx,c.sy,c.sz);
      cloudFade.setX(i,bank.fade);
    }
    cloudFade.needsUpdate=true;
    clouds.count=cloudData.length;clouds.instanceMatrix.needsUpdate=true;
    const fogFronts=activeFronts?.filter(f=>f.type==='fog'&&f.intensity>.02)??[];
    for(let i=0;i<haze.length;i++){const h=haze[i],f=fogFronts[i%fogFronts.length];
      h.sprite.position.x=(f?f.x+h.x/65*f.radius*.7:h.x)+Math.sin(time*.02+h.phase)*14;
      h.sprite.position.z=f?f.z+h.z/150*f.radius:h.z;
      const density=options.weatherSystem?.sample(h.sprite.position.x,h.sprite.position.z).fog;
      h.sprite.material.opacity=density!==undefined?.025+density*.23:foggy?.19:storm?.105:clear?.036:.068;
    }
    for(let i=0;i<rainCount;i++){
      const r=rainSeeds[i],f=rainFronts[i%rainFronts.length]; if(!f)continue;
      const x=f.x+r.x*f.radius+Math.sin(time*.11+r.phase)*2,z=f.z+r.z*f.radius;
      const amount=options.weatherSystem?.sample(x,z).rain??f.intensity;
      const base=terrainHeight(x,z),height=amount>.025?base+2+((r.y-time*(storm?29:21))%64+64)%64:-100;
      rainPositions.set([x,height,z,x+wx*.06,height-2.7,z+wz*.06],i*6);
    }rainGeometry.attributes.position.needsUpdate=true;
    for(let i=0;i<snowCount;i++){const s=snowSeeds[i],f=snowFronts[i%snowFronts.length];if(!f)continue;const x=f.x+s.x*f.radius,z=f.z+s.z*f.radius,amount=options.weatherSystem?.sample(x,z).snow??f.intensity,y=amount>.025?terrainHeight(x,z)+2+((s.y-time*3)%58+58)%58:-100;snowPositions.set([x+Math.sin(time*.7+s.phase)*2,y,z+Math.cos(time*.31+s.phase)*2],i*3);}snowGeometry.attributes.position.needsUpdate=true;
    front.visible=rainFronts.length>0;
    if(rainFronts.length){const f=rainFronts[0],sx=Math.max(.6,f.radius/65);front.scale.x=sx;front.position.set(f.x-112*sx,0,f.z+32);frontMaterial.opacity*=f.intensity;lightning.position.set(f.x+9,terrainHeight(f.x,f.z)+35,f.z-8);}
    const pulse=options.weatherSystem?options.weatherSystem.lightning:(storm&&Math.sin(time*.63)>0.995&&Math.sin(time*19)>0?1:0);lightningMaterial.opacity=(pulse||0)*.85;
    for(let i=0;i<people.length;i++){
      const view=people[i],p=village.villagers[i],walking=p.speed>.01;
      view.person.position.set(p.x,p.y+(walking?Math.sin(p.walkPhase*2)*.035:0),p.z);view.person.rotation.y=p.heading;
      view.person.userData.state=p.state;
      const watching=p.state==='watch'||p.state==='wave';
      view.person.scale.y=p.state==='duck'?.6:1;view.body.rotation.x=p.state==='duck'?.55:p.state==='forage'?.32:0;
      view.head.rotation.x=watching?-Math.min(.85,Math.atan2(p.lookY-p.y-2,Math.hypot(p.lookX-p.x,p.lookZ-p.z))):0;
      for(let j=0;j<4;j++){view.limbs[j].rotation.z=p.state==='wave'&&j===1?-.7+Math.sin(time*7+i)*.35:0;view.limbs[j].rotation.x=p.state==='wave'&&j===1?-2:walking?Math.sin(p.walkPhase+(j%2?Math.PI:0))*(j<2?.34:.52):p.state==='duck'?(j<2?-1.4:.55):p.state==='campfire'?(j<2?-.2:-.55):p.state==='forage'?(j<2?-.6+Math.sin(time*2+i)*.1:.08):p.state==='gather'?(j<2?-.25:0):0;}
    }
    animateWildlife();
    const localRain=options.weatherSystem?.sample(35,20).rain??(rainy?.8:0),fireStrength=1-localRain*.72;
    for(let i=0;i<flames.length;i++){const f=flames[i];f.scale.set((1+Math.sin(time*8+i)*.13)*fireStrength,(.7+Math.sin(time*6+i*1.7)*.24)*fireStrength,fireStrength);f.rotation.z=Math.sin(time*5+i)*.14;}
    fireLight.intensity=(22+Math.sin(time*13)*4+Math.sin(time*8)*3)*(1.8-daylight*.8)*fireStrength;
    for(let i=0;i<smoke.length;i++){const age=(time*.18+i/smoke.length)%1,s=smoke[i];s.position.set(35+wx*age*1.8+Math.sin(age*9+i)*age*2,fireY+3+age*20,20+wz*age*1.8+Math.cos(age*7+i)*age*2);s.scale.setScalar(2+age*9);s.material.opacity=(1-age)*.22;}
    for(let i=0;i<60;i++){const age=(time*.6+i/60)%1;sparkPositions.set([35+Math.sin(i*13+age*5)*age*2+wx*age*.12,fireY+.7+age*7,20+Math.cos(i*9+age*6)*age*2],i*3);}sparksGeometry.attributes.position.needsUpdate=true;
    ripples.children.forEach(r=>{r.scale.x=1.2+Math.sin(time*.9+r.userData.phase)*.55;});
    waterMaterial.color.setHex(storm?0x6b9098:0x669fa6);
  }
  animate(0, {weather:'mixed', daylight:1});
  return {
    root, terrain:land, villageCenter, terrainHeight, villagers:village.villagers, village, perches, wildlife:wildlifeSimulation.animals, wildlifeSimulation,
    interact(x,z,kind='gather') {return village.interact(x,z,kind);},
    scare(x,z) {return village.scare(x,z);},
    reset() {village.reset();wildlifeSimulation.reset();for(const bank of cloudBanks){bank.x=bank.initialX;bank.z=bank.initialZ;}lastTime=0;animate(0,{weather:'mixed',daylight:1});},
    update(dt,time,options={}) { if (!Number.isFinite(dt)||!(dt>0)) return; village.step(dt,options);wildlifeSimulation.step(dt,options); lastTime=Number.isFinite(time)?time:lastTime+dt; animate(lastTime,options,dt); },
  };
}
