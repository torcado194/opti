const {ipcRenderer} = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const fileType = require('file-type');

const mod = (x, n) => (x % n + n) % n;

let canDrag = false,
    dragging = false,
    wasDragging = false,
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
    moveAnimId,
    rotateAnimId,
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
    border = false,
    pinned = false;


ipcRenderer.on('open', (event, p) => {
    console.log(p);
    if(p && p.length > 0){
        p.slice(1).forEach((f, i) => {
            if(i === 0){
                console.log('load', f);
                loadFile(f);
            } else {
                console.log('instance', f);
                loadInstance(f);
            }
        });
    }
});

function loadInstance(file){
    console.log('send', file);
    ipcRenderer.send('new', file);
}

window.addEventListener('close', e => {
    if(moveAnimId){
        cancelAnimationFrame(moveAnimId);
        moveAnimId = null;
    }
    if(rotateAnimId){
        cancelAnimationFrame(rotateAnimId);
        rotateAnimId = null;
    }
});

function test(){
    ipcRenderer.send('test', filename);
}

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
    
    vidEl.addEventListener('play', e => {
        if(dragging || wasDragging) {
            wasDragging = false;
            vidEl.pause();
        }
    });
    
    vidEl.addEventListener('pause', e => {
        if(dragging || wasDragging) {
            wasDragging = false;
            vidEl.play();
        }
    });
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
        case 'Escape':
            window.close();
            break;
        case ' ':
            resetAll();
            break;
        case 't':
            test();
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
    if(e.button === 0){
        mouseDown = true;
    } else if(e.button === 2){
        mouseRightDown = true;
    }
    wasDragging = false;
    mouseStartX = e.clientX;  
    mouseStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;
    startAngle = angle;
    
    e.stopPropagation();
    e.preventDefault();
    
    if(!ctrl && !moveAnimId && mouseDown){
        moveAnimId = requestAnimationFrame(moveWindow);
    }
    if(/*!ctrl && */!rotateAnimId && mouseRightDown){
        rotateAnimId = requestAnimationFrame(mouseMoveGlobal);
    }
}

function onMouseUp(e) {
    if(e.button === 0){
        mouseDown = false;
    } else if(e.button === 2){
        mouseRightDown = false;
    }
    if(dragging){
        dragging = false;
        wasDragging = true;
        e.stopPropagation();
        e.preventDefault();
    }
    ipcRenderer.send('windowMoved');
    cancelAnimationFrame(moveAnimId);
    moveAnimId = null;
    cancelAnimationFrame(rotateAnimId);
    rotateAnimId = null;
}

function moveWindow() {
    if(!ctrl){
        console.log(filename);
        ipcRenderer.send('windowMoving', mouseStartX, mouseStartY, filename);
        moveAnimId = requestAnimationFrame(moveWindow);
    }
}

function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if(mouseDown && (mouseX !== mouseStartX || mouseY !== mouseStartY)){
        dragging = true;
    }
    if(!ctrl){
        return;
    }
    if(ctrl && mouseDown){
        pan(mouseX - mouseStartX, mouseY - mouseStartY);
    }
}

function mouseMoveGlobal(){
    let {x, y} = ipcRenderer.sendSync('getCursorPosition');
    mouseX = x;
    mouseY = y;
    if(mouseRightDown){
        rotateCoords(mouseX, mouseY, mouseStartX, mouseStartY);
    }
    rotateAnimId = requestAnimationFrame(mouseMoveGlobal);
}

function pan(x, y){
    panX = panStartX + x;
    panY = panStartY + y;
    containerEl.style.left = `${panX}px`;
    containerEl.style.top = `${panY}px`;
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
    if(pathname === '.'){
        return;
    }
    fs.readFile(pathname, (err, buffer) => {
        if(err){
            console.error(err);
        }
        console.log();
        loadData(buffer, fileType(buffer).mime);
    });
    
    loadDirectory(pathname);
}

function loadData(data, mime){
    if(mime){
        data = `data:${mime};base64,${data.toString('base64')}`;
    } else {
        //"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFQAAABUCAYAAAAcaxDBAAAACXBIWXMAAAsSAAALEgHS3X78AAAAG3RFWHRTb2Z0d2FyZQBDZWxzeXMgU3R1ZGlvIFRvb2zBp+F8AAAB8klEQVR42u3dMU7DMBTG8foyDIgbUDgFF0AMjMxwAGYYGRAX4BQQblAx9DLugmRHinFsPycv9v+bqrYvcX+NnGcPrbHW7tbOmTHFgzhaa3YKYgAFtG/QOVjH7yHv4Pfv7jy/HyrQAQW0I9ApvGysAtzg+CbQpZEBBbRxUB9xMTxBdB9ZAhdQQBsEDSLuL6cLhh/1sFK4gALaCGgyombQiriAArph0OSWaCtzaEVcQAHtCTSSi6v95POHyLFz6wAFFNAoqPhmx+eXe/zy6JCMG9fh4dm95+a6rG5lXEABBXR6Xnx9mg+aUgcooIBqAfUxRu1PBDSprjLoCM/DtX+4gNYAHSGe37qKtztAAQW0c9DA3XfWWj50h/YTAQ3WpSb2BQAKKKBZoN7Aq27fFYwLUEABlWubthpAAQW0dKUkvpqRPvYMREABBfTfD7oPbGxIZAi1Tbm4gAIKqOjcVrCxEl3lANojqJ8U3C2BJiLOAvXT3apJ4KocvQ4ooIBG59nceRPQDkEXw10TVPjOrgO0oXkTUHWguQ3/xiABBbQz0CZwBRD9ALrAVQmoBtAk2DWQC5r1UkRAAW0YtAhXYSQQAQW0E9AQrh9N0FPNutX6C7eAAqobNHiCALStCJ27DgcUUEAXh5aIXfGPVgAFFNCuAqhwTmrGtJU90Z9+AAAAAElFTkSuQmCC"
        [mime, data] = data.split(',');
    }
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
    resetAll();
}

function resetAll(){
    if(curEl === imgEl){
        width = curEl.naturalWidth;
        height = curEl.naturalHeight;
    } else if(curEl === vidEl) {
        width = curEl.videoWidth;
        height = curEl.videoHeight;
    }
    startAngle = 0;
    rotate(0);
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
    //TODO: multiple files here too
    if(!file || !file.name){
        return console.warn('no file');
    }
    
    loadFile(file.path);
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
