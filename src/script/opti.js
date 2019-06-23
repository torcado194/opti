const {ipcRenderer} = require('electron');
const fs = require('fs');
const path = require('path');
const DataURI = require('datauri');
const datauri = new DataURI();

const mod = (x, n) => (x % n + n) % n;

let canDrag = false,
    imgEl,
    vidEl,
    curEl,
    containerEl,
    clipEl,
    width = 0,
    height = 0,
    zoomStage = 0,
    zoom = 1,
    ignoreResize = [],
    filepath,
    filename,
    localFiles = [],
    fileIndex = 0,
    shift,
    ctrl,
    animationId,
    mouseStartX,
    mouseStartY,
    mouseX,
    mouseY,
    mouseDown = false,
    mouseRightDown = false,
    panX = 0,
    panY = 0,
    panStartX = 0,
    panStartY = 0,
    angle = 0,
    startAngle = 0,
    clipAngle = 0,
    clipStartAngle = 0,
    border = false,
    pinned = false;


ipcRenderer.on('open', (event, p) => {
    console.log(p);
    if(p && p !== '.'){
        loadFile(p);
    }
});

window.addEventListener('beforeunload', e => {
    ipcRenderer.send('setClickthrough', false);
});

function init(){
    console.log('ready');
    
    ipcRenderer.send('resize', 500, 500);
    
    imgEl = document.getElementById('image');
    vidEl = document.getElementById('video');
    
    containerEl = document.getElementById('container');
    clipEl = document.getElementById('clip');
    
    border = document.body.classList.contains('border');
    
    clipEl.addEventListener('mouseenter', e => {
        onMouseEnter();
        ipcRenderer.send('setClickthrough', false);
    });
    clipEl.addEventListener('mouseleave', e => {
        onMouseEnter();
        ipcRenderer.send('setClickthrough', true);
    });
    /*window.addEventListener('mouseover', e => {
        console.log('s');
        document.getElementById('drag').style.display = 'block';
        setTimeout(()=>{
            document.getElementById('drag').style.display = 'none';
        }, 200);
    });
    
    window.addEventListener('mouseleave', e => {
        console.log('l')
        document.getElementById('drag').style.display = 'none';
    });*/
}
window.onload = init;


window.addEventListener('keydown', e => {
    switch(e.key){
        case 'Shift':
            shift = true;
            break;
        case 'Control':
            ctrl = true;
            break;
        case 'ArrowRight':
            nextFile();
            break;
        case 'ArrowLeft':
            prevFile();
            break;
        case 'ArrowUp':
            relZoom(1);
            break;
        case 'ArrowDown':
            relZoom(-1);
            break;
        case 'b':
            toggleBorder();
            break;
        case 'a':
            togglePinned();
            break;
    }
});
window.addEventListener('keyup', e => {
    if(e.key === 'Shift'){
    }
    if(e.key === 'Control'){
        //document.body.classList.remove('border');
    }
    switch(e.key){
        case 'Shift':
            shift = false;
            break;
        case 'Control':
            ctrl = false;
            break;
    }
});

window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);
window.addEventListener('mousemove', onMouseMove);
window.document.addEventListener('mouseenter', onMouseEnter);
window.document.addEventListener('mouseleave', onMouseLeave);

function onMouseDown(e) {
    if(e.button === 0){
        mouseDown = true;
    } else if(e.button === 2){
        mouseRightDown = true;
    }
    mouseStartX = e.clientX;  
    mouseStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;
    startAngle = angle;
    clipStartAngle = clipAngle;
    
    e.stopPropagation();
    e.preventDefault();
    
    if(!ctrl && !animationId && mouseDown){
        animationId = requestAnimationFrame(moveWindow);
    }
}

function onMouseUp(e) {
    if(e.button === 0){
        mouseDown = false;
    } else if(e.button === 2){
        mouseRightDown = false;
    }
    if(mouseX < 0 || mouseX > window.outerWidth || mouseY < 0 || mouseY > window.outerHeight){
        onMouseLeave();
    }
    ipcRenderer.send('windowMoved');
    cancelAnimationFrame(animationId);
    animationId = null;
}

function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if(ctrl){
        if(mouseDown){
            pan(mouseX - mouseStartX, mouseY - mouseStartY);
        }
        if(mouseRightDown){
            rotateCoords(mouseX, mouseY, mouseStartX, mouseStartY);
        }
    } else {
        if(mouseRightDown){
            rotateClipCoords(mouseX, mouseY, mouseStartX, mouseStartY);
        }
    }
}

function onMouseEnter(e){
    //resizeMax();
}

function onMouseLeave(e){
    /*if(!mouseDown && !mouseRightDown){
        resetSize();
    }*/
}

function moveWindow() {
    if(!ctrl){
        ipcRenderer.send('windowMoving', mouseStartX, mouseStartY);
        animationId = requestAnimationFrame(moveWindow);
    }
}


function pan(x, y){
    
    let a = Math.atan2(y, x),
        m = Math.hypot(x, y);
    a -= clipAngle * Math.PI / 180;
    panX = panStartX + m * Math.cos(a);
    panY = panStartY + m * Math.sin(a);
    
    containerEl.style.left = `${panX}px`;
    containerEl.style.top = `${panY}px`;
}

function rotateClipCoords(x, y, origX, origY){
    let centerX = window.innerHeight / 2,
        centerY = window.innerWidth / 2;
    let origAngle = mod((180 / Math.PI) * Math.atan2(origY - centerY, origX - centerX), 360),
        curAngle = mod((180 / Math.PI) * Math.atan2(y - centerY, x - centerX), 360);
    rotateClip(curAngle - origAngle);
}

function rotateClip(a){
    clipAngle = mod((clipStartAngle + a), 360);
    clipEl.style.transform = `translate(-50%, -50%) rotate(${clipAngle}deg)`;
    
    //resetSize();
    //resetClip();
}

function rotateCoords(x, y, origX, origY){
    let bounds = curEl.getBoundingClientRect(),
        centerX = bounds.x + bounds.width / 2,
        centerY = bounds.y + bounds.height / 2;
    let origAngle = mod((180 / Math.PI) * Math.atan2(origY - centerY, origX - centerX), 360),
        curAngle = mod((180 / Math.PI) * Math.atan2(y - centerY, x - centerX), 360);
    rotate(curAngle - origAngle);
}

function rotate(a){
    angle = mod((startAngle + a), 360);
    containerEl.style.transform = `rotate(${angle}deg)`;
    
    //resetSize();
    //resetClip();
}

function resetClip(){
    //let {width, height} = containerEl.getBoundingClientRect();
    
    let width = curEl.clientWidth,
        height = curEl.clientHeight;
    
    clipEl.style.width = width + 'px';
    clipEl.style.height = height + 'px';
}

function toggleBorder(){
    border = !border;
    if(border){
        document.body.classList.add('border');
    } else {
        document.body.classList.remove('border');
    }
}

function togglePinned(){
    ipcRenderer.send('setAlwaysOnTop', pinned = !pinned);
    console.log(pinned);
}


function loadFile(pathname){
    datauri.encode(pathname, (err, data) => {
        if(err){
            return console.error(err);
        }
        loadData(data);
        //loadDirectory(pathname);
    });
}

function loadData(data){
    let mime;
    curEl && curEl.removeAttribute('src');
    if(data[5] === 'i'){
        mime = 'image';
        
        if(curEl && curEl !== imgEl){
            curEl.removeAttribute('src');
        }
        
        curEl = imgEl;
        curEl.setAttribute('src', data);
        curEl.onload = loadDone;
    } else if(data[5] === 'v'){
        mime = 'video';
        
        if(curEl && curEl !== imgEl){
            curEl.removeAttribute('src');
        }
        
        curEl = vidEl;
        curEl.setAttribute('src', data);
        curEl.onloadedmetadata = loadDone;
    } else {
        mime = undefined;
    }
}

function loadDone(){
    if(curEl === imgEl){
        width = curEl.naturalWidth;
        height = curEl.naturalHeight;
    } else if(curEl === vidEl) {
        width = curEl.videoWidth;
        height = curEl.videoHeight;
    }
    zoom = 1;
    zoomStage = 0;
    relZoom(0);
    ipcRenderer.send('resize', width, height, true);
}

window.addEventListener('dragover', drag);
window.addEventListener('drop', drop);

function drag(e){
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
}

function drop(e){
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if(!file || !file.name){
        return console.warn('no file');
    }
    
    filePath = file.path;
    
    const reader = new FileReader();
    reader.onload = function(e){
        loadData(e.target.result);
    }
    reader.readAsDataURL(file);
    
    loadDirectory(filePath);
}

function loadDirectory(dir, name){
    fs.lstat(dir, (err, stats) => {
        if(err){
            return console.error(err);
        }
        if(!stats.isDirectory()){
            filename = name = path.basename(dir);
            filepath = dir = path.resolve(dir, '..');
        }
        fs.readdir(dir, (err, list) => {
            if(err){
                return console.error(err);
            }
            localFiles = list;
            fileIndex = list.indexOf(name);
            console.log(list, name, fileIndex);
        });
    })
}

function nextFile(){
    fileIndex = mod((fileIndex + 1), localFiles.length);
    loadFile(path.resolve(filepath, localFiles[fileIndex]));
}

function prevFile(){
    fileIndex = mod((fileIndex - 1), localFiles.length);
    loadFile(path.resolve(filepath, localFiles[fileIndex]));
}

window.addEventListener('mousewheel', e => {
    relZoom(-e.deltaY);
});

function relZoom(dir){
    if(!curEl){
        return;
    }
    console.log(zoom);
    if(zoom === null){
        let scale = Math.min(curEl.clientWidth, curEl.clientHeight) / Math.min(width, height);
        console.log(scale);
        if(scale >= 1){
            zoomStage = Math.round(scale) - 1;
        } else {
            zoomStage = 1 - Math.round(1/scale);
        }
    }
    if(shift){
        if(dir < 0){
            zoomStage -= 8;
        } else if(dir > 0) {
            zoomStage += 8;
        }
    } else {
        if(dir < 0){
            zoomStage--;
        } else if(dir > 0) {
            zoomStage++;
        }
    }
    
    updateZoom();
}

function updateZoom(){
    if(!curEl){
        return;
    }
    if(zoomStage >= 0){
        zoom = zoomStage + 1;
    } else {
        //zoomStage = Math.max(-10, zoomStage);
        zoom = 1 / (Math.abs(zoomStage) + 1);
    }
    if(zoom > 1){
        curEl.classList.add('pixel');
    } else {
        curEl.classList.remove('pixel');
    }
    
    let newWidth = Math.min(screen.availWidth, width * zoom);
    let newHeight = Math.min(screen.availHeight, height * zoom);
    if(newWidth >= process.env.MIN_WIDTH || newHeight >= process.env.MIN_HEIGHT){
        curEl.classList.add('contain');
    } else {
        curEl.classList.remove('contain');
    }
    
    curEl.setAttribute('width', width * zoom);
    if(ctrl || width * zoom > newWidth || height * zoom > newHeight){
        curEl.classList.remove('contain');
    }
    if(!ctrl){
        ignoreResize.push(true);
        //resize(newWidth, newHeight);
        resizeMax(newWidth, newHeight);
        pan(panX = panStartX = 0, panY = panStartY = 0);
    }
}

function resize(width, height){
    width = Math.min(screen.availWidth, width);
    height = Math.min(screen.availHeight, height);
    ipcRenderer.send('resize', Math.round(width), Math.round(height), true);
}

function resetSize(){
    if(!curEl){
        return;
    }
    let {width, height} = curEl.getBoundingClientRect();
    
    //width = curEl.clientWidth*Math.abs(Math.cos(angle * Math.PI / 180)) + curEl.clientHeight*Math.abs(Math.sin(angle * Math.PI / 180));
    //height = curEl.clientHeight*Math.abs(Math.cos(angle * Math.PI / 180)) + curEl.clientWidth*Math.abs(Math.sin(angle * Math.PI / 180));
    
    width = Math.min(screen.availWidth, width);
    height = Math.min(screen.availHeight, height);
    resetClip();
    ipcRenderer.send('resize', Math.round(width), Math.round(height), true);
}

function resizeMax(){
    if(!curEl){
        return;
    }
    let {width, height} = curEl.getBoundingClientRect();
    
    //width = curEl.clientWidth*Math.abs(Math.cos(angle * Math.PI / 180)) + curEl.clientHeight*Math.abs(Math.sin(angle * Math.PI / 180));
    //height = curEl.clientHeight*Math.abs(Math.cos(angle * Math.PI / 180)) + curEl.clientWidth*Math.abs(Math.sin(angle * Math.PI / 180));
    let a = Math.atan((curEl.clientHeight) / (curEl.clientWidth));
    
    width = (curEl.clientWidth)*Math.abs(Math.cos(a)) + (curEl.clientHeight)*Math.abs(Math.sin(a));
    //height = curEl.clientHeight*Math.abs(Math.cos(a2)) + curEl.clientWidth*Math.abs(Math.sin(a2));
    height = width;
    
    width = Math.min(screen.availWidth, width);
    height = Math.min(screen.availHeight, height);
    resetClip();
    ipcRenderer.send('resize', Math.round(width), Math.round(height), true);
}


window.addEventListener('resize', onResize);

function onResize(e){
    if(ignoreResize.length > 0){
        ignoreResize.pop();
        return;
    }
    zoom = null;
    curEl && curEl.classList.remove('pixel');
}