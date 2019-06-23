const {ipcRenderer} = require('electron');
const fs = require('fs');
const path = require('path');
const DataURI = require('datauri');
const datauri = new DataURI();
const mime = require('mime-types');

const mod = (x, n) => (x % n + n) % n;

let canDrag = false,
    imgEl,
    vidEl,
    curEl,
    containerEl,
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
    panX = 0,
    panY = 0,
    panStartX = 0,
    panStartY = 0,
    border = false,
    pinned = false;


ipcRenderer.on('open', (event, p) => {
    console.log(p);
    if(p && p !== '.'){
        loadFile(p);
    }
});

function init(){
    console.log('ready');
    
    ipcRenderer.send('resize', 500, 500);
    
    imgEl = document.getElementById('image');
    vidEl = document.getElementById('video');
    
    containerEl = document.getElementById('container');
    
    border = document.body.classList.contains('border');
    
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

function onMouseDown(e) {
    mouseDown = true;
    mouseStartX = e.clientX;  
    mouseStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;
    
    e.stopPropagation();
    e.preventDefault();
    
    if(!ctrl && !animationId){
        animationId = requestAnimationFrame(moveWindow);
    }
}

function onMouseUp(e) {
    mouseDown = false;
    ipcRenderer.send('windowMoved');
    cancelAnimationFrame(animationId);
    animationId = null;
}

function moveWindow() {
    if(!ctrl){
        ipcRenderer.send('windowMoving', mouseStartX, mouseStartY);
        animationId = requestAnimationFrame(moveWindow);
    }
}

function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if(!ctrl){
        return;
    }
    if(mouseDown){
        pan(mouseX - mouseStartX, mouseY - mouseStartY);
    }
}

function pan(x, y){
    panX = panStartX + x;
    panY = panStartY + y;
    containerEl.style.left = `${panX}px`;
    containerEl.style.top = `${panY}px`;
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
        ipcRenderer.send('resize', Math.round(newWidth), Math.round(newHeight), true);
        pan(panX = panStartX = 0, panY = panStartY = 0);
    }
}

window.addEventListener('resize', onResize);

function onResize(e){
    if(ignoreResize.length > 0){
        ignoreResize.pop();
        return;
    }
    zoom = null;
    curEl.classList.remove('pixel');
}