import { terrainHeight, riverX } from './terrain.js';

// All scenery is made locally. A seeded stream keeps the valley identical on reload.
export function createWorld(THREE, scene) {
  let seed = 928401;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const root = new THREE.Group(); root.name = 'Living valley'; scene.add(root);
  const villageCenter = { x: 35, z: 20 };
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, ...extra });
  const mesh = (geometry, material, parent = root) => { const m = new THREE.Mesh(geometry, material); parent.add(m); return m; };
  const dummy = new THREE.Object3D();
  const green = new THREE.Color();
  const soil = [0x84a875, 0x91b17c, 0xa0ba85, 0x8eaa79, 0x7d9f74].map(c => new THREE.Color(c));
  const stoneColors = [0x889799, 0x98a5a1, 0xa5afa5, 0x7d9290].map(c => new THREE.Color(c));

  // Independent triangles give the terrain its quiet, hand cut facets.
  const positions = [], colors = [];
  const steps = 82, span = 420;
  function terrainVertex(x, z, color) { positions.push(x, terrainHeight(x, z), z); colors.push(color.r, color.g, color.b); }
  for (let zi = 0; zi < steps; zi++) for (let xi = 0; xi < steps; xi++) {
    const x = -210 + xi * span / steps, z = -210 + zi * span / steps, s = span / steps;
    const height = terrainHeight(x + s / 2, z + s / 2);
    const c = (height > 32 ? stoneColors : soil)[Math.floor(rand() * (height > 32 ? stoneColors.length : soil.length))].clone();
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
  const land = mesh(landGeometry, mat(0xffffff, { vertexColors: true })); land.receiveShadow = true;

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
  const riverPoints = Array.from({ length: 170 }, (_, i) => { const z = -214 + i * 428 / 169; return { x: riverX(z), y: -2.5, z }; });
  const waterMaterial = mat(0x669fa6, { metalness: 0.28, roughness: 0.32, transparent: true, opacity: 0.86, side: THREE.DoubleSide });
  ribbon(riverPoints, riverPoints.map((p, i) => 20 + 1.4 * Math.sin(i * 0.17)), waterMaterial);
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

  const trunkGeo = new THREE.CylinderGeometry(0.34, 0.48, 1, 5);
  const coniferGeo = new THREE.ConeGeometry(1, 1, 6);
  const canopyGeo = new THREE.IcosahedronGeometry(1, 0);
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
    } else if (leafCount < 520) {
      green.setHSL(0.22 + rand() * 0.13, 0.25 + rand() * 0.18, 0.35 + rand() * 0.13);
      instance(leaves, leafCount++, x, y + h * 0.72, z, w * 1.35, h * 0.43, w * 1.2, rotation, green);
    }
  }
  trunks.count = trunkCount; needles.count = needleCount; leaves.count = leafCount;
  trunks.castShadow = needles.castShadow = leaves.castShadow = true;

  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat(0x9a9b88), 240); root.add(rocks);
  for (let i = 0; i < 240; i++) {
    const z = (rand() - 0.5) * 400, x = i < 135 ? riverX(z) + (rand() > 0.5 ? 1 : -1) * (11 + rand() * 8) : (rand() - 0.5) * 380;
    const s = 0.5 + rand() * 2.0;
    instance(rocks, i, x, terrainHeight(x, z) + s * 0.24, z, s, s * 0.55, s * 0.85, rand() * 6.28);
  }
  const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.11, 2.5, 3), mat(0x999767), 440); root.add(reeds);
  for (let i = 0; i < 440; i++) {
    const z = (rand() - 0.5) * 390, x = riverX(z) + (rand() > 0.5 ? 1 : -1) * (10.5 + rand() * 4);
    instance(reeds, i, x, terrainHeight(x, z) + 0.8, z, 1, 0.6 + rand() * 0.55, 1, rand() * 6.28);
  }

  const pathMaterial = mat(0xb6ab83, { side: THREE.DoubleSide });
  const tents = [];
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
    const a = i / 6 * Math.PI * 2 + 0.2, x = 35 + Math.cos(a) * (13 + i % 2 * 4), z = 20 + Math.sin(a) * (13 + i % 2 * 4);
    const tent = new THREE.Group(); tent.position.set(x, terrainHeight(x, z) + 0.15, z); tent.rotation.y = -a + Math.PI / 2; root.add(tent); tents.push(tent);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-3,0,-3.8, 0,4.1,-3.8, -3,0,3.8, 0,4.1,-3.8,0,4.1,3.8,-3,0,3.8, 0,4.1,-3.8,3,0,-3.8,0,4.1,3.8, 3,0,-3.8,3,0,3.8,0,4.1,3.8, -3,0,-3.8,3,0,-3.8,0,4.1,-3.8],3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,0,1,1,0,1,0,0,1,0,0,1,1,0,1,1,0,1,0,0,1,0,.5,1],2)); g.computeVertexNormals();
    const cloth = mesh(g, tentMaterial, tent); cloth.castShadow = true;
    pole(tent, new THREE.Vector3(0,0,-4), new THREE.Vector3(0,4.5,-4)); pole(tent,new THREE.Vector3(0,0,4),new THREE.Vector3(0,4.5,4)); pole(tent,new THREE.Vector3(0,4.15,-4.1),new THREE.Vector3(0,4.15,4.1));
    const entrance = mesh(new THREE.PlaneGeometry(3.0, 2.3), mat(0x534637, { side: THREE.DoubleSide }), tent); entrance.position.set(0,1.15,3.78);
    const points = Array.from({length: 14}, (_, j) => { const t = j / 13; const px = 35 + (x - 35) * t, pz = 20 + (z - 20) * t; return {x:px,y:terrainHeight(px,pz)+0.055,z:pz}; });
    ribbon(points, points.map(() => 2.5), pathMaterial);
  }
  const riversidePath = Array.from({length:50},(_,i)=>{const z=-64+i*2.5,x=riverX(z)+23;return{x,y:terrainHeight(x,z)+.07,z};});
  ribbon(riversidePath,riversidePath.map(()=>2),pathMaterial);

  // People have actual articulated arms and legs, and small paths to follow.
  const people = [], skin = mat(0xad805b), hair = mat(0x403831);
  const limbGeometry = new THREE.CylinderGeometry(0.14, 0.12, 0.85, 5), headGeometry = new THREE.SphereGeometry(0.29, 6, 5);
  for (let i = 0; i < 10; i++) {
    const person = new THREE.Group(); root.add(person); const clothes = mat([0x8e7357,0xbca981,0x8c9370,0x986e4f][i%4]);
    const body = mesh(new THREE.CylinderGeometry(0.32,0.4,0.9,5), clothes, person); body.position.y=1.4;
    const head=mesh(headGeometry,skin,person);head.position.y=2.09;
    const cap=mesh(new THREE.SphereGeometry(.29,6,4,0,Math.PI*2,0,Math.PI*.5),hair,person);cap.position.y=2.16;
    const limbs=[];
    for(let j=0;j<4;j++){const pivot=new THREE.Group();person.add(pivot);const arm=j<2;pivot.position.set((j%2?1:-1)*(arm?.42:.18),arm?1.78:.99,0);const m=mesh(limbGeometry,arm?skin:clothes,pivot);m.position.y=-.43;limbs.push(pivot);}
    people.push({person,limbs,phase:i*.73,radius:8+i%4*3,centerX:35+(i>6?-12:0),centerZ:20+(i>6?15:0),speed:.045+i*.003});
  }

  const fireY=terrainHeight(35,20)+.3;
  const fireRing=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.65,0),mat(0x787967),12);root.add(fireRing);
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

  // High, thin ivory banks stay behind the flock. Unlit color avoids stone-like dark facets.
  const cloudMaterial=new THREE.MeshBasicMaterial({color:0xf2f1e6,transparent:true,opacity:.48,depthWrite:false});
  const clouds=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),cloudMaterial,48);root.add(clouds);
  const cloudData=[];
  for(let bank=0;bank<12;bank++){
    const x=(rand()-.5)*400,z=-185+rand()*195,y=106+rand()*29;
    for(let j=0;j<4;j++){cloudData.push({x:x+(rand()-.5)*23,y:y+rand()*2,z:z+(rand()-.5)*10,sx:5+rand()*6,sy:1.5+rand()*1.7,sz:4+rand()*4,phase:rand()*6.28});}
  }
  const haze=[];
  for(let i=0;i<22;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:soft,color:0xd9e0d8,opacity:.065,transparent:true,depthWrite:false}));s.position.set((rand()-.5)*130,6+rand()*9,(rand()-.5)*300);s.scale.set(72+rand()*70,13+rand()*10,1);root.add(s);haze.push({sprite:s,x:s.position.x,z:s.position.z,phase:rand()*6.28});}

  const rainCount=1050, rainPositions=new Float32Array(rainCount*6), rainSeeds=[];
  for(let i=0;i<rainCount;i++)rainSeeds.push({x:62+rand()*105,z:-75+rand()*155,y:rand()*64,phase:rand()*25});
  const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:0xc3d5d6,transparent:true,opacity:.22,depthWrite:false}));root.add(rain);
  const snowCount=500,snowPositions=new Float32Array(snowCount*3),snowSeeds=[];
  for(let i=0;i<snowCount;i++)snowSeeds.push({x:-170+rand()*72,z:-115+rand()*205,y:rand()*65,phase:rand()*6.28});
  const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.BufferAttribute(snowPositions,3));
  const snow=new THREE.Points(snowGeometry,new THREE.PointsMaterial({color:0xf4f3e8,size:.35,transparent:true,opacity:.72,depthWrite:false}));root.add(snow);
  // The rain front has its own dark bank and cool curtain at the eastern tree line.
  const front=new THREE.Group();root.add(front);
  const frontMaterial=new THREE.MeshBasicMaterial({color:0xc7d5d3,transparent:true,opacity:.45,depthWrite:false});
  for(let i=0;i<7;i++){const c=mesh(new THREE.IcosahedronGeometry(1,2),frontMaterial,front);c.position.set(70+i*14,96+Math.sin(i)*2,-32+Math.cos(i*.8)*9);c.scale.set(12,3.3,9);}
  const lightningMaterial=new THREE.MeshBasicMaterial({color:0xebf1e3,transparent:true,opacity:0,depthWrite:false});
  const lightning=mesh(new THREE.CylinderGeometry(.25,.4,48,4),lightningMaterial);lightning.position.set(121,35,-8);

  let lastTime = 0;
  function animate(time, options={}) {
    const mode=options.weather||'mixed';
    const wind=options.wind; const wx=typeof wind==='number'?wind:(wind?.x??3), wz=typeof wind==='object'?(wind?.z??0):0;
    const daylight=options.daylight??1;
    const storm=mode==='storm', rainy=storm||mode==='rain';
    const foggy=mode==='fog';
    const clear=mode==='clear';
    rain.visible=rainy||mode==='mixed';snow.visible=mode==='snow'||mode==='mixed';
    rain.material.opacity=storm?.55:rainy?.38:.22;
    snow.material.opacity=mode==='snow'?.9:.68;
    frontMaterial.opacity=storm?.68:clear?.24:.45;
    frontMaterial.color.setHex(storm?0x91a6ad:0xc7d5d3);
    cloudMaterial.opacity=clear?.38:storm?.61:.48;
    cloudMaterial.color.setHex(storm?0xc3d1d2:0xf2f1e6);
    for(let i=0;i<cloudData.length;i++){const c=cloudData[i];const x=((c.x+time*wx*.12+230)%460+460)%460-230;const z=((c.z+time*wz*.12+220)%440+440)%440-220;instance(clouds,i,x,c.y+Math.sin(time*.035+c.phase)*1.1,z,c.sx,c.sy,c.sz);}
    clouds.count=cloudData.length;clouds.instanceMatrix.needsUpdate=true;
    for(const h of haze){h.sprite.position.x=h.x+Math.sin(time*.02+h.phase)*14;h.sprite.material.opacity=foggy?.19:storm?.105:clear?.036:.068;}
    for(let i=0;i<rainCount;i++){
      const r=rainSeeds[i],base=terrainHeight(r.x,r.z),height=base+2+((r.y-time*(storm?29:21))%64+64)%64;
      const x=r.x+Math.sin(time*.11+r.phase)*2;
      rainPositions.set([x,height,r.z,x+wx*.06,height-2.7,r.z+wz*.06],i*6);
    }rainGeometry.attributes.position.needsUpdate=true;
    for(let i=0;i<snowCount;i++){const s=snowSeeds[i],y=terrainHeight(s.x,s.z)+2+((s.y-time*3)%58+58)%58;snowPositions.set([s.x+Math.sin(time*.7+s.phase)*2,y,s.z+Math.cos(time*.31+s.phase)*2],i*3);}snowGeometry.attributes.position.needsUpdate=true;
    const pulse=storm&&Math.sin(time*.63)>0.995&&Math.sin(time*19)>0?1:0;lightningMaterial.opacity=pulse*.85;
    for(let i=0;i<people.length;i++){const p=people[i],angle=time*p.speed+p.phase,z=p.centerZ+Math.sin(angle)*p.radius,x=Math.max(p.centerX+Math.cos(angle)*p.radius,riverX(z)+22);p.person.position.set(x,terrainHeight(x,z),z);p.person.rotation.y=-angle;p.person.position.y+=Math.sin(time*5+i)*.025;for(let j=0;j<4;j++)p.limbs[j].rotation.x=Math.sin(time*5+p.phase+(j%2?Math.PI:0))*(j<2?.3:.43);}
    for(let i=0;i<flames.length;i++){const f=flames[i];f.scale.set(1+Math.sin(time*8+i)*.13,.7+Math.sin(time*6+i*1.7)*.24,1);f.rotation.z=Math.sin(time*5+i)*.14;}
    fireLight.intensity=(22+Math.sin(time*13)*4+Math.sin(time*8)*3)*(1.8-daylight*.8);
    for(let i=0;i<smoke.length;i++){const age=(time*.18+i/smoke.length)%1,s=smoke[i];s.position.set(35+wx*age*1.8+Math.sin(age*9+i)*age*2,fireY+3+age*20,20+wz*age*1.8+Math.cos(age*7+i)*age*2);s.scale.setScalar(2+age*9);s.material.opacity=(1-age)*.22;}
    for(let i=0;i<60;i++){const age=(time*.6+i/60)%1;sparkPositions.set([35+Math.sin(i*13+age*5)*age*2+wx*age*.12,fireY+.7+age*7,20+Math.cos(i*9+age*6)*age*2],i*3);}sparksGeometry.attributes.position.needsUpdate=true;
    ripples.children.forEach(r=>{r.scale.x=1.2+Math.sin(time*.9+r.userData.phase)*.55;});
    waterMaterial.color.setHex(storm?0x6b9098:0x669fa6);
  }
  animate(0, {weather:'mixed', daylight:1});
  return {
    root, terrain:land, villageCenter, terrainHeight,
    update(dt,time,options={}) { if (!(dt>0)) return; lastTime=Number.isFinite(time)?time:lastTime+dt; animate(lastTime,options); },
  };
}
