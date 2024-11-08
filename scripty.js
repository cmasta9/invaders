import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const alienImg = './graphics/alien.png';
const bgImg = './graphics/galaxyLoop.png';
const pumpkin = './graphics/pumpkin.glb';
const jackO = './graphics/jackO.glb';
const corn = './graphics/cornStalk.glb';

const pointsHUD = document.getElementById('points');
const hpHUD = document.getElementById('HP');

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,1000);
const rend = new THREE.WebGLRenderer();
const loader = new THREE.TextureLoader();
const gLoader = new GLTFLoader();
const bgTex = loader.load(bgImg);
const alienMap = loader.load(alienImg);
bgTex.colorSpace = THREE.SRGBColorSpace;
rend.setSize(window.innerWidth,window.innerHeight);
document.body.appendChild(rend.domElement);

const maxInput = 3;
const maxHP = 5;
let input = [0,0];
let spd = 0.01;
let shootSpd = 0.05;
let alienSpd = 0.01;
const boxDist = 30;
const bulLife = 4;
const bulletRad = 0.1;
const alienSpawnTimeInit = 5;

let pause = false;
let mouseDown = false;
let clicked = false;
const doubleTapThresh = 0.42;
let tapCounter = undefined;
let dmgCD = 2;
let dmg = false;

const colors = [];
const balls = [];
const aliens = [];
const boxes = [];
const scenery = [];

const box = new THREE.BoxGeometry(1,1,1);
const ball = new THREE.SphereGeometry(bulletRad,4,4);
const planeG = new THREE.PlaneGeometry(100,100);

const alienMat = new THREE.SpriteMaterial( {map : alienMap} );

const redMat = new THREE.MeshBasicMaterial({color: 0xaa0000});
const orangeMat = new THREE.MeshBasicMaterial({color: 0xaa6900});
const yellowMat = new THREE.MeshBasicMaterial({color: 0xaaaa00});
const greenMat = new THREE.MeshBasicMaterial({color: 0x00aa00});
const blueMat = new THREE.MeshBasicMaterial({color: 0x0042aa});
const indigoMat = new THREE.MeshBasicMaterial({color: 0x000069});
const purpleMat = new THREE.MeshBasicMaterial({color: 0x110042});

const groundMat = new THREE.MeshBasicMaterial({color: 0x004200});
const spaceMat = new THREE.MeshBasicMaterial({map: bgTex, side: THREE.DoubleSide});

colors.push(redMat);
colors.push(orangeMat);
colors.push(yellowMat);
colors.push(greenMat);
colors.push(blueMat);
colors.push(indigoMat);
colors.push(purpleMat);


//SET STATE

let hp = maxHP;
let points = 0;
hpHUD.innerHTML = setHP(hp);
pointsHUD.innerText = `Points: ${points}`;

const dome = new THREE.OctahedronGeometry(50,2);
const sky = new THREE.Mesh(dome,spaceMat);
const light = new THREE.DirectionalLight(0xffffff,0.5);
const ground = new THREE.Mesh(planeG,groundMat);
ground.position.y = -1;
ground.rotation.x = -Math.PI/2;
scene.add(ground);
scene.add(light);
scene.add(sky);
spawnBoxes();
setDecoration(corn,420,[1,1,1]);
setDecoration(pumpkin,20,[0.22,0.22,0.22]);
setDecoration(jackO,5,[0.22,0.22,0.22]);
cam.position.z = 0;
rend.render(scene,cam);
rend.setAnimationLoop(anim);
const alienSpawner = window.setInterval(()=>{
    if(!pause){
        spawnAlien();
    }
},alienSpawnTimeInit*1000);

function anim(){

    if(!pause){
        if(hp<1){
            pause = true;
            death();
        }else{
            moveBoxes();
            if(balls.length > 0){
                moveBalls();
            }
            if(aliens.length > 0){
                moveAliens();
            }
            cam.rotation.y += input[0]*spd;
            rend.render(scene,cam);
        }
    }
}

function moveBoxes(){
    for(let i = 0; i < boxes.length; i++){
        boxes[i].rotation.x -= input[1]*spd;
        boxes[i].rotation.y += input[0]*spd;
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

        for(let a = 0; a < aliens.length; a++){
            if(balls[i] && aliens[a]){
                if(near(balls[i].position,aliens[a].position,bulletRad*2)){
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

function moveAliens(){
    for(let i = 0; i < aliens.length; i++){
        if(!near(aliens[i].position,cam.position,1)){
            const d = dir(aliens[i].position,cam.position);
            //console.log(d);
            aliens[i].position.x += d.x * alienSpd;
            aliens[i].position.y += d.y * alienSpd;
            aliens[i].position.z += d.z * alienSpd;
        }
        else{
            damage();
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
    bullet.position.y = camDir.y;
    bullet.position.z = camDir.z;
    //console.log(bullet.position);
    scene.add(bullet);
    balls.push(bullet);
    window.setTimeout(()=>{
        const bindex = balls.indexOf(bullet);
        scene.remove(bullet);
        if(bindex > -1){
            balls.splice(bindex,1);
        }
    },bulLife*1000);
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

function spawnBoxes(){
    for(let i = 0; i < colors.length; i++){
        //console.log(colors[i]);
        boxes.push(new THREE.Mesh(box,colors[i]));
        //console.log(cube);
    }
    
    console.log(boxes.length);
    
    for(let i = 0; i < boxes.length; i++){
        boxes[i].position.z = Math.cos(2*Math.PI/colors.length*i) * boxDist;
        boxes[i].position.x = Math.sin(2*Math.PI/colors.length*i) * boxDist;
        scene.add(boxes[i]);
    }
}

function spawnAlien(){
    const alienSpt = new THREE.Sprite(alienMat);
    const alienBox = Math.floor(Math.random()*boxes.length);
    let alienPos = new THREE.Vector3();
    boxes[alienBox].getWorldPosition(alienPos);
    alienPos.x /= 2;
    alienPos.z /= 2;
    alienPos.y = ground.position.y;
    alienSpt.position.x = alienPos.x;
    alienSpt.position.z = alienPos.z;

    scene.add(alienSpt);
    aliens.push(alienSpt);
}

function setDecoration(ob,n,scale){
    for(let i = 0; i < n; i++){
        gLoader.load(ob,function(o){
            const obj = o.scene;
            obj.scale.x = scale[0];
            obj.scale.y = scale[1];
            obj.scale.z = scale[2];
            obj.rotation.y = Math.random() * 2 * Math.PI;
            obj.position.x = Math.random() * 30 + 2;
            if(Math.round(Math.random()) < 1){
                obj.position.x = -obj.position.x;
            }
            obj.position.z = Math.random() * 30 + 2;
            if(Math.round(Math.random()) < 1){
                obj.position.z = -obj.position.z;
            }
            const size = new THREE.Vector3();
            new THREE.Box3().setFromObject(obj).getSize(size);
            obj.position.y = ground.position.y + size.y/2;
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
        setTimeout(()=>{
            dmg = false;
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
    console.log('GAME OVER');
}