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
    border = false;

function init(){
    console.log('ready');
    
    ipcRenderer.send('resize', 500, 500);
    
    curEl = imgEl = document.getElementById('image');
    vidEl = document.getElementById('video');
    
    console.log(screen);
    
    border = document.body.classList.contains('border');
    
    window.addEventListener('keydown', e => {
        if(e.key === 'Shift'){
        }
        if(e.key === 'Control'){
            //document.body.classList.add('border');
        }
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


let animationId;
let mouseX;
let mouseY;

window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);

function onMouseDown(e) {
    mouseX = e.clientX;  
    mouseY = e.clientY;
    
    e.stopPropagation();
    e.preventDefault();
    
    document.addEventListener('mouseup', onMouseUp)
    if(!animationId){
        animationId = requestAnimationFrame(moveWindow);
    }
}

function onMouseUp(e) {
    ipcRenderer.send('windowMoved');
    document.removeEventListener('mouseup', onMouseUp)
    cancelAnimationFrame(animationId);
    animationId = null;
}

function moveWindow() {
    ipcRenderer.send('windowMoving', { mouseX, mouseY });
    animationId = requestAnimationFrame(moveWindow);
}

function toggleBorder(){
    border = !border;
    if(border){
        document.body.classList.add('border');
    } else {
        document.body.classList.remove('border');
    }
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
    curEl.removeAttribute('src');
    if(data[5] === 'i'){
        mime = 'image';
        
        if(curEl !== imgEl){
            curEl.removeAttribute('src');
        }
        
        curEl = imgEl;
        curEl.setAttribute('src', data);
        curEl.onload = loadDone;
    } else if(data[5] === 'v'){
        mime = 'video';
        
        if(curEl !== imgEl){
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
    console.log(e);
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
    
    curEl.setAttribute('width', newWidth);
    ignoreResize.push(true);
    ipcRenderer.send('resize', Math.round(newWidth), Math.round(newHeight), true);
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