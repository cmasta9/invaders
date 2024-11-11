import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const bgImg = './graphics/galaxyLoop.png';
const groundTex = './graphics/groundTex.jpg';
const alienMod = './graphics/alien2.glb';
const pumpkin = './graphics/pumpkin.glb';
const jackO = './graphics/jackO.glb';
const corn = './graphics/cornStalk.glb';
const ufo = './graphics/ufo.glb';

const bgMusic = './sound/otherworldly_3.ogg';
const shoot = './sound/SE_magicShoot.mp3';
const boom = './sound/SE_magicExplode3.mp3';

const pointsHUD = document.getElementById('points');
const hpHUD = document.getElementById('HP');
const cenText = document.getElementById('center');

const music = document.createElement("AUDIO");
const seShoot = document.createElement("AUDIO");
const seHit = document.createElement("AUDIO");
seShoot.loop = false;
seHit.loop = false;
seShoot.src = shoot;
seHit.src = boom;
music.src = bgMusic;
music.loop = true;

let start = false;

cenText.innerText = 'LOADING...';

let loadProg = 0;

const stageDim = 54;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,0.1,stageDim/2+1);
const tLoader = new THREE.TextureLoader();
const gLoader = new GLTFLoader();
const bgTex = tLoader.load(bgImg);
const gTex = tLoader.load(groundTex);
gTex.wrapS = THREE.RepeatWrapping;
gTex.wrapT = THREE.RepeatWrapping;
gTex.repeat.set(stageDim/4,stageDim/4);
bgTex.colorSpace = THREE.SRGBColorSpace;

const explosion = [];
for(let i = 0; i < 6; i++){
    const exp = tLoader.load(`./graphics/explode${i}.png`);
    exp.colorSpace = THREE.SRGBColorSpace;
    explosion.push(exp);
}

const rend = new THREE.WebGLRenderer();
const comp = new EffectComposer(rend);
comp.addPass(new RenderPass(scene,cam));
const rgbPass = new ShaderPass(RGBShiftShader);
rgbPass.uniforms['amount'].value = 0.02;
comp.addPass(new OutputPass());
rend.setSize(window.innerWidth,window.innerHeight);
comp.setSize(window.innerWidth,window.innerHeight);
const ratio = rend.getPixelRatio();
document.body.appendChild(rend.domElement);

const maxInput = 3;
const maxHP = 5;
let input = [0,0];
let spd = 0.01;
let shootSpd = 0.05;
let alienSpd = 0.01;
let fallSpd = 0.05;
let ufoSpd = 0.19;
let ufoSleepTime = 2;
let alienScale = 0.5;
let damgDist = 0.8;
let alienSize = new THREE.Vector3();
let alienBox = new THREE.Box3();
let ballBox = new THREE.Box3();
const hitBoxComp = -0.2;
const explodeTime = 0.69;

const camHeight = 0.54;
const spawnDist = stageDim*2/5;
const bulletRad = 0.1;
const ufoHeight = 5;
const numSpawners = 11;

let touchX = '';

let pause = false;
let mouseDown = false;
const doubleTapThresh = 0.42;
let tapCounter = undefined;
let dmgCD = 2.5;
let dmg = false;
let activeSpawner = 0;
let ufoSleep = null;

const pumps = 42;
const jackOs = 22;
const corns = 1111;

const balls = [];
const aliens = [];
const mixers = [];
const spawners = [];
const scenery = [];

let dTime = 0;

const ball = new THREE.SphereGeometry(bulletRad,4,4);
const planeG = new THREE.PlaneGeometry(stageDim,stageDim);

const redMat = new THREE.MeshLambertMaterial({color: 0xaa0000});
const groundMat = new THREE.MeshLambertMaterial({map: gTex});
const spaceMat = new THREE.MeshBasicMaterial({map: bgTex, side: THREE.DoubleSide});

//SET STATE

let hp = maxHP;
let points = 0;
hpHUD.innerHTML = setHP(hp);
pointsHUD.innerText = `Points: ${points}`;

const dome = new THREE.OctahedronGeometry(stageDim/2,2);
const sky = new THREE.Mesh(dome,spaceMat);
const light = new THREE.DirectionalLight(0xffffff,0.3);
const ground = new THREE.Mesh(planeG,groundMat);
ground.rotation.x = -Math.PI/2;
ground.position.y = 0;
scene.add(ground);
scene.add(light);
scene.add(sky);
scene.fog = new THREE.Fog(0xaaaaaa,1,stageDim-6);

cam.position.y = ground.position.y + camHeight;

let ufoObj = null;

gLoader.load(ufo,function(o){
    ufoObj = o.scene;
    ufoObj.position.y = ufoHeight;
    ufoObj.position.x = spawnDist;
    ufoObj.position.z = 0;
    scene.add(ufoObj);
});

spawnSpawners(numSpawners);
setDecoration(pumpkin,pumps,[0.22,0.22,0.22],0.46);
setDecoration(jackO,jackOs,[0.22,0.22,0.22],0.46);
setDecoration(corn,corns,[1,1.2,1],0.2,true);
chooseSpawn();
comp.render();
rend.setAnimationLoop(anim);

function anim(){

    if(!pause && start){
        if(hp<1){
            pause = true;
            death();
        }else{
            if(balls.length > 0){
                moveBalls();
            }
            if(aliens.length > 0){
                moveAliens((Number(Date.now())-dTime)/1000);
                dTime = Number(Date.now());
            }
            if(ufoObj){
                moveUFO();
            }
            cam.rotation.y += input[0]*spd;
            comp.render();
        }
    }else if(!pause){
        if(loadProg >= pumps+jackOs+corns){
            cenText.innerText = 'CLICK TO START';
        }else if(loadProg < pumps+jackOs+corn){
            cenText.innerText = `${loadProg}/${pumps+jackOs+corn}`;
        }
        comp.render();
    }
}

function moveUFO(){
    const dis = dist(ufoObj.position,spawners[activeSpawner].position);
    if(dis > ufoSpd){
        ufoObj.position.x += dir(ufoObj.position,spawners[activeSpawner].position).x*ufoSpd;
        ufoObj.position.z += dir(ufoObj.position,spawners[activeSpawner].position).z*ufoSpd;
    }
    else{
        if(!ufoSleep){
            spawnAlien();
            ufoSleep = window.setTimeout(()=>{
                activeSpawner = chooseSpawn();
                ufoSleep = null;
            },ufoSleepTime*1000);
        }
    }
}

function moveBalls(){
    for(let i = 0; i < balls.length; i++){
        const d = dir(balls[i].position,cam.position);
        balls[i].position.x -= d.x * shootSpd;
        balls[i].position.y -= d.y * shootSpd;
        balls[i].position.z -= d.z * shootSpd;

        if(Math.abs(balls[i].position.x) > stageDim*2/5 || Math.abs(balls[i].position.z) > stageDim*2/5){
            scene.remove(balls[i]);
            balls.splice(i,1);
        }

        for(let a = 0; a < aliens.length; a++){
            if(aliens[a]){
                if(balls[i]){
                    alienBox.setFromObject(aliens[a]);
                    alienBox.expandByScalar(hitBoxComp);
                    if(ballBox.setFromObject(balls[i]).intersectsBox(alienBox)){
                        scene.remove(balls[i]);
                        balls.splice(i,1);
                        const al = aliens[a];
                        explode(al.position);
                        aliens.splice(a,1);
                        mixers.splice(a,1);
                        window.setTimeout(()=>{
                            scene.remove(al);
                            points++;
                            pointsHUD.innerText = `Points: ${points}`;
                        },explodeTime/2*1000);
                        //console.log(`hit! ${points}`);
                    }
                }
            }
        }
    }
}

function moveAliens(dt){
    for(let i = 0; i < aliens.length; i++){
        if(aliens[i].position.y > ground.position.y + alienSize.y/2){
            aliens[i].position.y -= fallSpd;
        }else{
            if(!near(aliens[i].position,cam.position,damgDist)){
                const d = dir(aliens[i].position,cam.position);
                aliens[i].position.x += d.x * alienSpd;
                aliens[i].position.z += d.z * alienSpd;
                mixers[i].update(dt);
            }
            else{
                damage();
            }
        }
    }
}

function near(q,r,tol){
    if(dist(q,r) <= tol){
        return true;
    }else{
        return false;
    }
}

function dist(i,f){
    return Math.sqrt(Math.pow(f.x-i.x,2)+Math.pow(f.y-i.y,2)+Math.pow(f.z-i.z,2));
}

function dir(i,f){
    return new THREE.Vector3(f.x-i.x,f.y-i.y,f.z-i.z).divideScalar(dist(i,f));
}

function doubleTap(){
    //console.log('logged a doubleTap');
    if(!pause){
        seShoot.play();
        let camDir = new THREE.Vector3();
        let bullet = new THREE.Mesh(ball,redMat);
        cam.getWorldDirection(camDir).multiplyScalar(0.2);
        bullet.position.x = camDir.x;
        bullet.position.y = camHeight;
        bullet.position.z = camDir.z;
        scene.add(bullet);
        balls.push(bullet);
    }
}

window.addEventListener('keydown', (k)=>{
    //console.log(`${k.key} down`);
    if(k.key == 'ArrowRight' && Math.abs(input[0]) < maxInput){
        input[0] += 1;
    }
    if(k.key == 'ArrowLeft' && Math.abs(input[0]) < maxInput){
        input[0] -= 1;
    }
});

window.addEventListener('keyup',(k)=>{
    console.log(`${k.key} up`);
    if(k.key == 'ArrowLeft' || k.key == 'ArrowRight'){
        input[0] = 0;
    }
});

window.addEventListener('mousedown',(e)=>{
    e.preventDefault();
    mouseDown = true;
});

window.addEventListener('touchstart',(e)=>{
    e.preventDefault();
    mouseDown = true;
    touchX = e.touches[0].clientX;
});

window.addEventListener('mouseup',()=>{
    mouseDown = false;
});

window.addEventListener('touchend',(e)=>{
    e.preventDefault();
    mouseDown = false;
});

window.addEventListener('click',(e)=>{
    e.preventDefault();
    if(tapCounter){
        doubleTap();
        clearTimeout(tapCounter);
        tapCounter = undefined;
    }else{
        if(!start){
            startGame();
        }else{
            tapCounter = setTimeout(()=>{
                clearTimeout(tapCounter);
                tapCounter = undefined;
            },doubleTapThresh*1000);
        }
    }
});

window.addEventListener('touchstart',(e)=>{
    e.preventDefault();
    if(tapCounter){
        doubleTap();
        clearTimeout(tapCounter);
        tapCounter = undefined;
    }else{
        if(!start){
            startGame();
        }else{
            tapCounter = setTimeout(()=>{
                clearTimeout(tapCounter);
                tapCounter = undefined;
            },doubleTapThresh*1000);
        }
    }
});

window.addEventListener('mousemove',(e)=>{
    if(mouseDown){
        cam.rotation.y += e.movementX * spd;
    }
});

window.addEventListener('touchmove',(e)=>{
    e.preventDefault();
    if(mouseDown){
        //cenText.innerText = `${e.touches[0].clientX},${touchX-e.touches[0].clientX}`;
        cam.rotation.y += (touchX-Number(e.touches[0].clientX)) * spd;
        touchX = e.touches[0].clientX;
    }
})

function spawnSpawners(n){
    for(let i = 0; i < n; i++){
        const spawner = new THREE.Object3D();
        spawner.visible = false;
        spawners.push(spawner);
    }
    
    console.log(spawners.length);
    
    for(let i = 0; i < spawners.length; i++){
        spawners[i].position.z = Math.cos(2*Math.PI/spawners.length*i) * spawnDist;
        spawners[i].position.x = Math.sin(2*Math.PI/spawners.length*i) * spawnDist;
        spawners[i].position.y = ufoHeight;
        scene.add(spawners[i]);
    }
}

function spawnAlien(){
    gLoader.load(alienMod,(o)=>{
        const obj = o.scene;
        let alienPos = new THREE.Vector3();
        spawners[activeSpawner].getWorldPosition(alienPos);
        obj.position.x = alienPos.x;
        obj.position.z = alienPos.z;
        obj.position.y = alienPos.y;
        obj.scale.x = alienScale;
        obj.scale.y = alienScale;
        obj.scale.z = alienScale;
        obj.lookAt(cam.position);
        new THREE.Box3().setFromObject(obj).getSize(alienSize);
        scene.add(obj);
        aliens.push(obj);
        const mixer = new THREE.AnimationMixer(obj);
        const action = mixer.clipAction(o.animations[0]);
        action.play();
        mixers.push(mixer);
    });
}

function chooseSpawn(n=-1){
    if(n > 0 && n < spawners.length){
        return n;
    }else{
        return Math.floor(Math.random()*spawners.length);
    }
}

function setDecoration(ob,n,scale,yOff=0.5){
    for(let i = 0; i < n; i++){
        gLoader.load(ob,function(o){
            const obj = o.scene;
            obj.scale.x = scale[0];
            obj.scale.y = scale[1];
            obj.scale.z = scale[2];
            obj.rotation.y = Math.random() * 2 * Math.PI;
            obj.position.x = Math.random() * (stageDim/2-1) + 0.5;
            if(Math.round(Math.random()) < 1){
                obj.position.x = -obj.position.x;
            }
            obj.position.z = Math.random() * (stageDim/2-1) + 0.5;
            if(Math.round(Math.random()) < 1){
                obj.position.z = -obj.position.z;
            }
            const size = new THREE.Vector3();
            new THREE.Box3().setFromObject(obj).getSize(size);
            obj.position.y = ground.position.y + size.y*yOff;
            if(!sceneryCollide(obj,size.x/2)){
                scene.add(obj);
                scenery.push(obj);
            }
            loadProg++;
        },undefined,(e)=>{console.error(e);});
    }
}

function sceneryCollide(o,t){
    for(let i = 0; i < scenery.length; i++){
        if(dist(o,scenery[i]) < t){
            return true;
        }
    }
    return false;
}

function explode(p){
    const exp = new THREE.Sprite(new THREE.SpriteMaterial({map: explosion[0]}));
    exp.position.x = p.x;
    exp.position.y = p.y;
    exp.position.z = p.z;
    let mat = 0
    scene.add(exp);
    const exploder = window.setInterval(()=>{
        if(mat < explosion.length){
            if(mat == 2){
                seHit.play();
            }
            exp.material = new THREE.SpriteMaterial({map: explosion[mat]});
            mat++;
        }else{
            scene.remove(exp);
            window.clearInterval(exploder);
        }
    },explodeTime/explosion.length*1000);
}

function damage(){
    if(!dmg){
        dmg = true;
        hp--;
        hpHUD.innerHTML = setHP(hp);
        comp.addPass(rgbPass);
        setTimeout(()=>{
            dmg = false;
            comp.removePass(rgbPass);
        },dmgCD*1000);
    }
}

function setHP(hp){
    let ret = '';
    for(let h = 0; h < hp; h++){
        ret = ret + '&#x2665;';
    }
    return ret;
}

function death(){
    fadeOut(music,3,0);
    rgbPass.uniforms['amount'].value = 0.1;
    cenText.innerText = 'GAME OVER';
    comp.render();
}

function startGame(){
    cenText.innerText = '';
    start = true;
    pause = false;
    fadeIn(music,1,1);
}

function fadeIn(a,t,v){
    a.volume = 0;
    a.play();
    const fade = setInterval(()=>{
        if(a.volume >= v){
            clearInterval(fade);
        }else{
            try{
                a.volume += v/10;
            }catch{
                a.volume = 1;
            }
        }
    },t/10*1000);
}

function fadeOut(a,t,v){
    const diff = a.volume - v;
    const fade = setInterval(()=>{
        if(a.volume <= v){
            clearInterval(fade);
        }else{
            try{
                a.volume -= diff/10;
            }catch{
                a.volume = 0;
            }
        }
    },t/10*1000);
}

window.addEventListener('resize',()=>{
    if(window.innerHeight > window.innerWidth/ratio){
        comp.setSize(window.innerHeight*ratio,window.innerHeight);
        rend.setSize(window.innerHeight*ratio,window.innerHeight);
    }
    else if(window.innerWidth < window.innerHeight*ratio){
        comp.setSize(window.innerWidth,window.innerWidth/ratio);
        rend.setSize(window.innerWidth,window.innerWidth/ratio);
    }else{
        comp.setSize(window.innerWidth,window.innerHeight);
        rend.setSize(window.innerWidth,window.innerHeight);
    }
});