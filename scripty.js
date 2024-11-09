import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const alienImg = './graphics/alien.png';
const bgImg = './graphics/galaxyLoop.png';
const pumpkin = './graphics/pumpkin.glb';
const jackO = './graphics/jackO.glb';
const corn = './graphics/cornStalk.glb';
const ufo = './graphics/ufo.glb';

const pointsHUD = document.getElementById('points');
const hpHUD = document.getElementById('HP');

const stageDim = 80;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,0.1,stageDim/2+1);
const tLoader = new THREE.TextureLoader();
const gLoader = new GLTFLoader();
const bgTex = tLoader.load(bgImg);
const alienMap = tLoader.load(alienImg);
bgTex.colorSpace = THREE.SRGBColorSpace;

const rend = new THREE.WebGLRenderer();
const comp = new EffectComposer(rend);
comp.addPass(new RenderPass(scene,cam));
const rgbPass = new ShaderPass(RGBShiftShader);
rgbPass.uniforms['amount'].value = 0.02;
comp.addPass(new OutputPass());
rend.setSize(window.innerWidth,window.innerHeight);
comp.setSize(window.innerWidth,window.innerHeight);
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

const camHeight = 0.54;
const spawnDist = stageDim*2/5;
const bulletRad = 0.1;
const ufoHeight = 5;
const numSpawners = 11;

let pause = false;
let mouseDown = false;
let clicked = false;
const doubleTapThresh = 0.42;
let tapCounter = undefined;
let dmgCD = 2.5;
let dmg = false;
let activeSpawner = 0;
let ufoSleep = null;

const balls = [];
const aliens = [];
const spawners = [];
const scenery = [];

const box = new THREE.BoxGeometry(1,1,1);
const ball = new THREE.SphereGeometry(bulletRad,4,4);
const planeG = new THREE.PlaneGeometry(stageDim,stageDim);

const alienMat = new THREE.SpriteMaterial( {map : alienMap} );
const redMat = new THREE.MeshBasicMaterial({color: 0xaa0000});
const groundMat = new THREE.MeshPhongMaterial({color: 0xaa6900});
const spaceMat = new THREE.MeshBasicMaterial({map: bgTex, side: THREE.DoubleSide});

//SET STATE

let hp = maxHP;
let points = 0;
hpHUD.innerHTML = setHP(hp);
pointsHUD.innerText = `Points: ${points}`;

const dome = new THREE.OctahedronGeometry(stageDim/2,2);
const sky = new THREE.Mesh(dome,spaceMat);
const light = new THREE.DirectionalLight(0xffffff,1);
const ground = new THREE.Mesh(planeG,groundMat);
ground.rotation.x = -Math.PI/2;
ground.position.y = 0;
scene.add(ground);
scene.add(light);
scene.add(sky);

cam.position.y = ground.position.y + camHeight;

let ufoObj = null;

gLoader.load(ufo,function(o){
    ufoObj = o.scene;
    ufoObj.position.y = ufoHeight;
    ufoObj.position.x = spawnDist;
    ufoObj.position.z = 0;
    scene.add(ufoObj);
});

console.log(ufoObj);

spawnSpawners(numSpawners);
setDecoration(pumpkin,42,[0.22,0.22,0.22],0.46);
setDecoration(jackO,12,[0.22,0.22,0.22],0.46);
setDecoration(corn,1111,[1,1.2,1],0.2);
chooseSpawn();
comp.render();
rend.setAnimationLoop(anim);
const alienSize = new THREE.Vector3();

function anim(){

    if(!pause){
        if(hp<1){
            pause = true;
            death();
        }else{
            if(balls.length > 0){
                moveBalls();
            }
            if(aliens.length > 0){
                moveAliens();
            }
            if(ufoObj){
                moveUFO();
            }
            cam.rotation.y += input[0]*spd;
            comp.render();
        }
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
        //console.log(balls[i]);
        const d = dir(balls[i].position,cam.position);
        //console.log(d);
        balls[i].position.x -= d.x * shootSpd;
        balls[i].position.y -= d.y * shootSpd;
        balls[i].position.z -= d.z * shootSpd;

        if(Math.abs(balls[i].position.x) > stageDim*2/5 || Math.abs(balls[i].position.z) > stageDim*2/5){
            scene.remove(balls[i]);
            balls.splice(i,1);
        }

        for(let a = 0; a < aliens.length; a++){
            if(aliens[a]){
                const alienBox = new THREE.Box3().setFromObject(aliens[a]);
                if(balls[i]){
                    if(new THREE.Box3().setFromObject(balls[i]).intersectsBox(alienBox)){
                        scene.remove(balls[i]);
                        scene.remove(aliens[a]);
                        balls.splice(i,1);
                        aliens.splice(a,1);
                        points++;
                        //console.log(`hit! ${points}`);
                        pointsHUD.innerText = `Points: ${points}`;
                    }
                }
            }
        }
    }
}

function moveAliens(){
    for(let i = 0; i < aliens.length; i++){
        if(aliens[i].position.y > ground.position.y + alienSize.y/2){
            aliens[i].position.y -= fallSpd;
        }else{
            if(!near(aliens[i].position,cam.position,1)){
                const d = dir(aliens[i].position,cam.position);
                //console.log(d);
                aliens[i].position.x += d.x * alienSpd;
                aliens[i].position.z += d.z * alienSpd;
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
    let camDir = new THREE.Vector3();
    let bullet = new THREE.Mesh(ball,redMat);
    cam.getWorldDirection(camDir);
    bullet.position.x = camDir.x;
    bullet.position.y = camHeight;
    bullet.position.z = camDir.z;
    //console.log(bullet.position);
    scene.add(bullet);
    balls.push(bullet);
}

window.addEventListener('keydown', (k)=>{
    //console.log(`${k.key} down`);
    if(k.key == 'ArrowUp' && Math.abs(input[1]) < maxInput){
        input[1] += 1;
    }
    if(k.key == 'ArrowDown' && Math.abs(input[1]) < maxInput){
        input[1] -= 1;
    }
    if(k.key == 'ArrowRight' && Math.abs(input[0]) < maxInput){
        input[0] += 1;
    }
    if(k.key == 'ArrowLeft' && Math.abs(input[0]) < maxInput){
        input[0] -= 1;
    }
});

window.addEventListener('keyup',(k)=>{
    console.log(`${k.key} up`);
    if(k.key == 'ArrowUp' || k.key == 'ArrowDown'){
        input[1] = 0;
    }
    if(k.key == 'ArrowLeft' || k.key == 'ArrowRight'){
        input[0] = 0;
    }
});

window.addEventListener('mousedown',()=>{
    mouseDown = true;
});

window.addEventListener('mouseup',()=>{
    mouseDown = false;
});

window.addEventListener('click',()=>{
    if(tapCounter){
        doubleTap();
        clearTimeout(tapCounter);
        tapCounter = undefined;
    }else{
        tapCounter = setTimeout(()=>{
            clearTimeout(tapCounter);
            tapCounter = undefined;
        },doubleTapThresh*1000);
    }
});

window.addEventListener('mousemove',(e)=>{
    if(mouseDown){
        cam.rotation.y += e.movementX * spd;
        //cam.rotation.x += e.movementY * spd;
    }
});

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
    const alienSpt = new THREE.Sprite(alienMat);
    let alienPos = new THREE.Vector3();
    spawners[activeSpawner].getWorldPosition(alienPos);
    alienSpt.position.x = alienPos.x;
    alienSpt.position.z = alienPos.z;
    alienSpt.position.y = alienPos.y;

    new THREE.Box3().setFromObject(alienSpt).getSize(alienSize);

    scene.add(alienSpt);
    aliens.push(alienSpt);
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
            obj.position.x = Math.random() * 30 + 0.5;
            if(Math.round(Math.random()) < 1){
                obj.position.x = -obj.position.x;
            }
            obj.position.z = Math.random() * 30 + 0.5;
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
    rgbPass.uniforms['amount'].value = 0.1;
    comp.render();
    console.log('GAME OVER');
}