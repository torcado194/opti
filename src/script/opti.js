const {ipcRenderer, clipboard, nativeImage, shell, screen} = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const fileType = require('file-type');
const gifFrames = require('gif-frames');
const apng = require('apng-js').default;
const http = require('http');
const https = require('https');
const { resolve } = require('dns');

const mod = (x, n) => (x % n + n) % n;

const MIN_WIDTH = parseInt(process.env.MIN_WIDTH);
const MIN_HEIGHT = parseInt(process.env.MIN_HEIGHT);

let canDrag = false,
    dragging = false,
    wasDragging = false,
    imgEl,
    vidEl,
    audEl,
    curEl,
    titleEl,
    helpEl,
    syncIndicatorEl,
    containerEl,
    imageContainerEl,
    vidPaused = false,
    width = 0,
    height = 0,
    zoomStage = 0,
    zoomStageStart = 0,
    zoom = 1,
    ignoreResize = [],
    ignoreReset = [],
    forceReset = false,
    screenBounds,
    filepath,
    filename,
    fullpath,
    localFiles = [],
    fileIndex = 0,
    shift,
    ctrl,
    alt,
    moveAnimId,
    rotateAnimId,
    mouseStartX,
    mouseStartY,
    mouseGlobalStartX,
    mouseGlobalStartY,
    mouseX,
    mouseY,
    mouseDown = false,
    mouseRightDown = false,
    curX,
    curY,
    panX = 0,
    panY = 0,
    panStartX = 0,
    panStartY = 0,
    angle = 0,
    startAngle = 0,
    angleSnap = 15,
    isRotated = false,
    opacity = 1,
    border = false,
    pinned = false,
    passthrough = false,
    windowLocked = false,
    context,
    curUrl,
    loadedData,
    loadedBuffer,
    loadedSource,
    mimeType,
    animated = false,
    frameRate,
    loadedGifFrames,
    accumulatedGifDelays,
    apngCanvas,
    apngObj,
    apngPlayer,
    loadedApngFrames,
    curSeekFrame = 0,
    seeking = false,
    playbackStart,
    mouseOffsetX = 0,
    mouseOffsetY = 0,
    syncTimeoutId,
    nameState = 0,
    userNameState = 0;

let MEDIA_EXTENSIONS = [
    'jpg',
    'jpeg',
    'jpe',
    'jif', 
    'jfif', 
    'jfi',
    'jxr',
    'hdp',
    'wdp',
    'jp2', 
    'j2k', 
    'jpf', 
    'jpx', 
    'jpm', 
    'mj2',
    'png',
    'apng',
    'gif',
    'agif',
    'webp',
    'mng',
    'tif',
    'tiff',
    'svg',
    'svgz',
    'pdf',
    'bmp',
    'dib',
    'xbm',
    'ico',
    'heif',
    'heic',
    
    'flac',
    'mp4',
    'mkv',
    'm4a',
    'mp3',
    'ogv',
    'ogm',
    'ogg',
    'oga',
    'opus',
    'webm',
    'wav',
    'amr',
    'avi',
    '3gp',
]


ipcRenderer.on('open', (event, p) => {
    if(p && p.length > 0){
        p.slice(1).forEach((f, i) => {
            /*if(f.startsWith('-')){
                return;
            }*/
            if(i === 0){
                console.log('f', f);
                loadFile(f);
            } else {
                loadInstance(f);
                console.log('i', f);
            }
        });
    }
});

function loadInstance(file){
    ipcRenderer.send('new', file);
    cancelSync();
}

function reload(){
    ipcRenderer.send('reload', fullpath);
    cancelSync();
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
    cancelSync();
});

function init(){
    console.log('ready');

    //hack to allow loading invalid certificates
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
    
    ipcRenderer.send('resize', 500, 500);
    
    let displays = screen.getAllDisplays();
    screenBounds = {x:0, y:0, width: window.screen.availWidth, height: window.screen.availHeight};
    displays.forEach(display => {
        if(display.bounds.x < screenBounds.x){
            screenBounds.x = display.bounds.x;
        }
        if(display.bounds.y < screenBounds.y){
            screenBounds.y = display.bounds.y;
        }
        if(display.bounds.x+display.bounds.width > screenBounds.width){
            screenBounds.width = display.bounds.x+display.bounds.width;
        }
        if(display.bounds.y+display.bounds.height > screenBounds.height){
            screenBounds.height = display.bounds.y+display.bounds.height;
        }
    });
    
    imgEl = document.getElementById('image');
    vidEl = document.getElementById('video');
    audEl = document.getElementById('audio');
    titleEl = document.getElementById('title');
    helpEl = document.getElementById('help');
    helpEl.style.opacity = ''
    syncIndicatorEl = document.getElementById('syncIndicator');
    syncIndicatorEl.style.opacity = ''
    
    containerEl = document.getElementById('container');
    imageContainerEl = document.getElementById('image-container');
    
    border = document.body.classList.contains('border');
    
    vidEl.addEventListener('play', e => {
        if(vidPaused && (dragging || wasDragging)) {
            wasDragging = false;
            vidEl.pause();
        }
    });
    
    vidEl.addEventListener('pause', e => {
        if(!vidPaused && (dragging || wasDragging)) {
            wasDragging = false;
            vidEl.play();
        }
    });
    let vol = ipcRenderer.sendSync('getData', "volume");
    if(vol !== null){
        vidEl.volume = parseFloat(vol);
        audEl.volume = parseFloat(vol);
    }
    vidEl.addEventListener('volumechange', e => {
        ipcRenderer.send('setData', "volume", vidEl.volume);
    });
    audEl.addEventListener('volumechange', e => {
        ipcRenderer.send('setData', "volume", audEl.volume);
    });
}
window.onload = init;


window.addEventListener('keydown', e => {
    checkMeta(e);
    switch(e.key.toLowerCase()){
        case 'arrowright':
            if(mouseDown || mouseRightDown){
                nudgeMouse(1, 0)
            } else if(e.shiftKey){
                nextMedia();
            } else {
                nextFile();
            }
            break;
        case 'arrowleft':
            if(mouseDown || mouseRightDown){
                nudgeMouse(-1, 0)
            } else if(e.shiftKey){
                prevMedia();
            } else {
                prevFile();
            }
            break;
        case 'arrowup':
            if(mouseDown || mouseRightDown){
                nudgeMouse(0, -1)
            } else if(e.altKey){
                parentDirectory();
            } else {
                if(shift){
                    adjustOpacity(1);
                } else {
                    relZoom(1);
                }
            }
            break;
        case 'arrowdown':
            if(mouseDown || mouseRightDown){
                nudgeMouse(0, 1)
            } else if(shift){
                adjustOpacity(-1);
            } else {
                relZoom(-1);
            }
            break;
        case 'b':
            toggleBorder();
            break;
        case 'a':
            togglePinned();
            break;
        case 'p':
            togglePassthrough();
            break;
        case 'l':
            toggleWindowLock();
            break;
        case 'escape':
            window.close();
            break;
        case ' ':
            e.preventDefault();
            e.stopPropagation();
            if(!e.repeat){
                if(!e.shiftKey && (curEl === vidEl || curEl === audEl)){
                    wasDragging = false;
                    togglePause();
                } else {
                    resetAll(false, e.ctrlKey);
                }
            }
            break;
        case 'c':
            if(e.ctrlKey){
                copy();
            }
            break;
        case 'v':
            if(e.ctrlKey){
                paste();
            }
            break;
        case 'o':
            if(fullpath){
                shell.showItemInFolder(fullpath);
            }
            break;
        case 'n':
            if(fullpath){
                toggleName();
            }
            break;
        case 'r':
            reload();
            break;
        case 'f':
            if(e.shiftKey){
                flipy();
            } else {
                flipx();
            }
            break;
        case 'enter':
            if(context === 'directory'){
                openDirectory();
            }
            break;
        case 'backspace':
            parentDirectory();
            break;
        case '?':
        case '/':
            toggleHelp();
            break;
        case '>':
        case '.':
            if(e.shiftKey){
                seekFrame(0.1);
            } else {
                seekFrame(1);
            }
            break;
        case '<':
        case ',':
            if(e.shiftKey){
                seekFrame(-0.1);
            } else {
                seekFrame(-1);
            }
            break;
        case 's':
            syncAnimation();
            break;
    }
}, true);
window.addEventListener('keyup', e => {
    checkMeta(e);
    switch(e.key.toLowerCase()){
        case ' ':
            e.preventDefault();
            break;
    }
}, true);

function checkMeta(e){
    if(typeof e.shiftKey === 'boolean'){
        shift = e.shiftKey;
    }
    if(typeof e.ctrlKey === 'boolean'){
        ctrl = e.ctrlKey;
    }
    if(typeof e.altKey === 'boolean'){
        alt = e.altKey;
    }
}

window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);
window.addEventListener('mousemove', onMouseMove);

function onMouseDown(e) {
    checkMeta(e);
    if(e.button === 0){
        mouseDown = true;
    } else if(e.button === 2){
        mouseRightDown = true;
    }
    wasDragging = false;
    vidPaused = vidEl.paused;
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
    if(mouseRightDown && !rotateAnimId){
        var pos = ipcRenderer.sendSync('getCursorPosition', true);
        mouseGlobalStartX = pos.x;
        mouseGlobalStartY = pos.y;
        if(alt){
            zoomStageStart = zoomStage
            rotateAnimId = requestAnimationFrame(mouseMoveGlobal);
        } else {
            rotateAnimId = requestAnimationFrame(mouseMoveGlobal);
        }
    }
}

function onMouseUp(e) {
    checkMeta(e);
    if(e.button === 0){
        mouseDown = false;
    } else if(e.button === 2){
        mouseRightDown = false;
    }
    mouseOffsetX = 0;
    mouseOffsetY = 0;
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
        ipcRenderer.send('windowMoving', mouseStartX - mouseOffsetX, mouseStartY - mouseOffsetY, filename);
        moveAnimId = requestAnimationFrame(moveWindow);
    }
}
function panWindow(dx, dy) {
    if(!ctrl){
        ipcRenderer.send('panWindow', dx, dy);
    }
}

function nudgeMouse(dx, dy) {
    if(shift){
        dx *= 10
        dy *= 10
    }
    mouseOffsetX += dx;
    mouseOffsetY += dy;
    updatePan()
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
    updatePan()
}

function updatePan(){
    if(ctrl && mouseDown){
        pan(mouseX - mouseStartX + mouseOffsetX, mouseY - mouseStartY + mouseOffsetY);
    }
}

function mouseMoveGlobal(){
    if(mouseRightDown){
        if(alt){
            let {x, y} = ipcRenderer.sendSync('getCursorPosition', true);
            mouseX = x;
            mouseY = y;
            zoomStage = zoomStageStart + (mouseY - mouseGlobalStartY + mouseOffsetY) / 100.0
            updateZoom()
        } else {
            let {x, y} = ipcRenderer.sendSync('getCursorPosition', false);
            mouseX = x;
            mouseY = y;
            rotateCoords(mouseX, mouseY, mouseStartX, mouseStartY);
        }
    }
    rotateAnimId = requestAnimationFrame(mouseMoveGlobal);
}

function copy(){
    if(curEl === imgEl){
        let copyDataURI = alt;
        if(loadedData){
            write();
        } else if(context === 'url') {
            getData(curUrl, data => {
                loadedData = data;
                write();
            });
        } else if(context === 'file') {
            getData(fullpath, data => {
                loadedData = data;
                write();
            });
        } else {
            //?
        }
        function write(){
            if(copyDataURI){
                clipboard.writeText(loadedData);
            } else {
                clipboard.writeImage(nativeImage.createFromDataURL(loadedData));
            }
        }
    }
    //TODO: video copy?
}

function paste(){
    let image = clipboard.readImage();
    forceReset = true; //holding control because ctrl+v, but should reset anyway
    if(image.isEmpty()){
        loadUrl(clipboard.readText());
    } else {
        loadData(image.toDataURL());
    }
}

function pan(x, y){
    panX = panStartX + x;
    panY = panStartY + y;
    containerEl.style.left = `${panX}px`;
    containerEl.style.top = `${panY}px`;
}

function rotateCoords(x, y, origX, origY){
    if(!curEl){
        return;
    }
    let bounds = curEl.getBoundingClientRect(),
        centerX = bounds.x + bounds.width / 2,
        centerY = bounds.y + bounds.height / 2;
    let origAngle = mod((180 / Math.PI) * Math.atan2(origY - centerY, origX - centerX), 360),
        curAngle = mod((180 / Math.PI) * Math.atan2(y - centerY, x - centerX), 360);
    rotate(curAngle - origAngle);
}

function rotate(a){
    angle = mod((startAngle + a), 360);
    if(shift){
        angle = Math.round(angle / angleSnap) * angleSnap;
    }
    containerEl.style.transform = `rotate(${angle}deg)`;
    if(!isRotated){
        isRotated = true;
        //resizeMax();
    }
}

function recenter(winW, winH){
    if(curEl){
        curX = ((winW || window.innerWidth)/2 - curEl.clientWidth/2);
        curY = ((winH || window.innerHeight)/2 - curEl.clientHeight/2);
        curEl.style.left = curX + 'px';
        curEl.style.top = curY + 'px';
    }
}

function flipx(){
    curEl && curEl.classList.toggle('flipx');
}

function flipy(){
    curEl && curEl.classList.toggle('flipy');
}

/*function resetSize(){
    let width = curEl && curEl.clientWidth,
        height = curEl && curEl.clientHeight;
    
    curWidth = Math.max(width, MIN_WIDTH);
    curHeight = Math.max(height, MIN_HEIGHT);
    
    curEl.style.width = curWidth + 'px';
    curEl.style.height = curHeight + 'px';
}*/

function toggleBorder(){
    border = !border;
    document.body.classList.toggle('border', border);
}

function togglePinned(){
    pinned = !pinned
    document.body.classList.toggle('pinned', pinned);
    ipcRenderer.send('setAlwaysOnTop', pinned);
}

function togglePassthrough(){
    ipcRenderer.send('setPassthrough', passthrough = !passthrough);
}

function toggleWindowLock(){
    windowLocked = !windowLocked;
    document.body.classList.toggle('locked', windowLocked);
}


function showDirectory(){
    curEl = imgEl;
    imgEl.src = 'image/optiFolder.svg';
    imgEl.onload = () => resetAll();
    nameState = 1;
    updateName();
}

function showFileError(){
    curEl = imgEl;
    imgEl.src = 'image/optiFileError.svg';
    imgEl.onload = () => resetAll(ctrl);
    nameState = 1;
    updateName();
}

function toggleName(){
    userNameState = nameState = mod(nameState+1,3);
    updateName();
}
function updateName(){
    if(nameState === 0){
        titleEl.textContent = '';
    } else if(nameState == 1){
        titleEl.textContent = path.basename(fullpath);
    } else if(nameState == 2){
        titleEl.textContent = fullpath;
    }
}

function toggleHelp(){
    helpEl.classList.toggle('show');
    updateHelp();
}

function updateHelp(){
    if(helpEl.classList.contains('show')){
        let table = helpEl.children[0];
        let xDiff = window.innerWidth - table.clientWidth;
        let yDiff = window.innerHeight - table.clientHeight;
        if(xDiff < 0 || yDiff < 0){
            if(xDiff < yDiff){
                table.style.transform = `scale(${1 - Math.abs(xDiff / table.clientWidth)})`;
            } else {
                table.style.transform = `scale(${1 - Math.abs(yDiff / table.clientHeight)})`;
            }
        } else {
            table.style.transform = '';
        }
    }
}

function togglePause(){
    if(curEl.paused === true){
        curEl.play();
    } else if(curEl.paused === false){
        curEl.pause();
    }
}

function openDirectory(pathname){
    if(!pathname){
        if(context !== 'directory'){
            return;
        }
        pathname = fullpath;
    }
    fs.readdir(pathname, (err, list) => {
        if(err){
            return console.error(err);
        }
        loadFile(path.resolve(pathname, list[0]));
    });
}

function parentDirectory(){
    openDirectory(path.resolve(fullpath, '..', '..'));
}

function loadFile(pathname, ignoreLoad){
    if(pathname === '.'){
        return;
    }
    curUrl = null;
    fullpath = pathname;
    console.log(fullpath)
    if(!ignoreLoad){
        loadDirectory(pathname);
    }
    fs.lstat(pathname, (err, stats) => {
        if(err){
            return console.error(err);
        }
        if(stats.isDirectory()){
            context = 'directory';
            showDirectory();
        } else {
            context = 'file';
            loadFileUrl(pathname);
        }
    });
}

async function readFirstNBytes(path, n) {
    const chunks = [];
    for await (let chunk of fs.createReadStream(path, { start: 0, end: n })) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

function loadUrl(url){
    if(url.startsWith('https')){
        (url.startsWith('https') ? https : http).get(url, res => {
            res.once('readable', () => {
                let chunk = res.read(196); //mp2t magic number extends to 196, ignoring that the next highest is 58 (ASF) then like 36
                res.destroy();
                
                context = 'url';
                fullpath = null;
                loadedData = null;
                curUrl = url;
                //TODO: maybe abstract this process
                let mime = getMimeType(chunk);
                load(mime, url);
            });
        });
    } else if(url.startsWith('data')) {
        context = 'uri';
        fullpath = null;
        loadedData = url;
        curUrl = url;
        //TODO: maybe abstract this process
        let mime = url.substring(url.indexOf(":")+1, url.indexOf(";"));
        load(mime, url);
    } else {
        tryLoad(url);
    }
}

function loadFileUrl(path){
    context = 'file';
    tryLoad(path);
    loadMetadata(path);
}

async function loadBuffer(){
    if(context === 'file'){
        loadFileBuffer();
        return Promise.resolve();
    } else if(context === 'url'){
        return new Promise((resolve, reject) => {
            getData(curUrl, ()=>{
                resolve();
            });
        });
    }
}

function loadFileBuffer(pathname = null){
    if(!pathname){
        pathname = fullpath;
    }
    if(!pathname){
        return;
    }
    loadedBuffer = fs.readFileSync(pathname);
}

function tryLoad(src){
    resetData();
    curEl && curEl.removeAttribute('src');

    tryImage();
    function tryImage(){
        curEl = imgEl;
        curEl.setAttribute('src', src);
        curEl.onerror = tryVideo;
        curEl.onload = loadDone;
    }
    function tryVideo(){
        curEl = vidEl;
        curEl.setAttribute('src', src);
        curEl.onerror = tryAudio;
        curEl.onloadedmetadata = loadDone;
    }
    function tryAudio(){
        curEl = audEl;
        curEl.setAttribute('src', src);
        curEl.onerror = showFileError;
        curEl.onloadedmetadata = loadDone;
    }
}

function load(mime, src, isData = false){
    resetData();
    mimeType = mime;
    loadedSource = src;
    if(isData) loadedData = src;
    curEl && curEl.removeAttribute('src');
    if(mime.startsWith('image') || mime.startsWith('application')){
        if(mime.includes("gif") || mime.includes("apng")){
            animated = true;
        }
        curEl = imgEl;
        curEl.setAttribute('src', src);
        curEl.onerror = showFileError;
        curEl.onload = loadDone;
    } else if(mime.startsWith('video')){
        animated = true;
        curEl = vidEl;
        curEl.setAttribute('src', src);
        curEl.onerror = showFileError;
        curEl.onloadedmetadata = loadDone;
    } else if(mime.startsWith('audio')){
        curEl = audEl;
        curEl.setAttribute('src', src);
        curEl.onerror = showFileError;
        curEl.onloadedmetadata = loadDone;
    } else {
        // tryLoad(src);
        showFileError();
    }
}

async function loadMetadata(src){
    let chunk = await readFirstNBytes(src, 196);
    let mime = getMimeType(chunk);
    mimeType = mime;
    if(mime.startsWith('image') || mime.startsWith('application')){
        if(mime.includes("gif") || mime.includes("apng")){
            animated = true;
        }
    } else if(mime.startsWith('video')){
        animated = true;
    }
}

function getData(url, cb){
    if(url.startsWith('http')){
        (url.startsWith('https') ? https : http).get(url, res => {
            let buffer;
            res.on('readable', () => {
                if(buffer){
                    let next = res.read();
                    if(next){
                        buffer = Buffer.concat([buffer, next]);
                    }
                } else {
                    buffer = res.read();
                }
                
            });
            res.on('end', () => {
                res.destroy();
                loadedBuffer = buffer;
                loadedData = `data:${getMimeType(buffer)};base64,${buffer.toString('base64')}`;
                cb(loadedData);
            })
        });
    } else {
        loadFileBuffer(url);
        loadedData = `data:${getMimeType(loadedBuffer)};base64,${loadedBuffer.toString('base64')}`;
        cb(loadedData);
    }
}

function getMimeType(data){
    let ft = fileType(data);
    if(!ft && context == 'file'){
        if(fullpath.toLowerCase().endsWith('svg')){
            return 'image/svg+xml';
        }
    }
    return ft.mime
}

function loadData(data, mime){
    if(mime === 'application/xml'){
        mime = 'image/svg+xml';
    }
    if(mime){
        data = `data:${mime};base64,${data.toString('base64')}`;
    } else {
        mime = data.match(/^data:(.+);/)[1];
    }
    load(mime, data, true);
}

function loadDone(){
    loadedSource = curEl.src;
    nameState = userNameState;
    if(curEl === imgEl && animated){
        playbackStart = Date.now();
    }
    if(forceReset){
        forceReset = false;
        resetAll();
    } else {
        resetAll(ctrl);
    }
}

function resetData(){
    cancelSync();
    loadedData = null;
    loadedBuffer = null;
    apngCanvas = null;
    apngObj = null;
    apngPlayer = null;
    loadedApngFrames = null;
    
    loadedGifFrames = null;
    animated = false;
    seeking = false;
    curSeekFrame = 0;
    mime = null;
    // filepath = null;
    // filename = null;
    // fullpath = null;
    loadedSource = null;
    // context = null;
    // curUrl = null;
}

function resetAll(saveState, keepFrame){
    if(curEl === imgEl){
        width = curEl.naturalWidth;
        height = curEl.naturalHeight;
    } else if(curEl === vidEl) {
        width = curEl.videoWidth;
        height = curEl.videoHeight;
    } else if(curEl === audEl) {
        width = curEl.clientWidth;
        height = curEl.clientHeight;
    }

    imgEl.classList.remove('forceMiddle');
    vidEl.classList.remove('forceMiddle');
    audEl.classList.remove('forceMiddle');
    if(width == 0 && height == 0){
        width = 400;
        height = 400;
        curEl.classList.add('forceMiddle');
        nameState = 1;
    }
    
    if(curEl !== vidEl) {
        vidEl.removeAttribute('src');
        vidEl.load();
    }
    if(curEl !== imgEl) {
        imgEl.removeAttribute('src');
    }
    if(curEl !== audEl) {
        audEl.removeAttribute('src');
        audEl.load();
    }

    if(!keepFrame){
        if(seeking && loadedSource){
            seeking = false;
            curSeekFrame = 0;
            curEl.src = loadedSource;
        }
    }
    cancelSync();
    
    updateName();

    vidEl.onload = null;
    vidEl.onerror = null;
    vidEl.onloadedmetadata = null;
    imgEl.onload = null;
    imgEl.onerror = null;
    audEl.onload = null;
    audEl.onerror = null;
    audEl.onloadedmetadata = null;
    if(!saveState){
        imgEl.classList.remove('flipx');
        imgEl.classList.remove('flipy');
        vidEl.classList.remove('flipx');
        vidEl.classList.remove('flipy');

        opacity = 1;
        containerEl.style.opacity = opacity;

        startAngle = 0;
        rotate(0);
        isRotated = false;
        zoom = 1;
        zoomStage = 0;
        relZoom(0);
        pan(panX = panStartX = 0, panY = panStartY = 0);
        vidPaused = false;
        if(!keepFrame){
            if(curEl){
                resizeWindow(Math.min(screenBounds.width, width), Math.min(screenBounds.height, height), true, true);
            } else {
                resizeWindow(500, 500, true, true);
            }
        } else {
            curEl.classList.add('contain');
        }
        recenter();
    }
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
    
    let files = Array.from(e.dataTransfer.files);
    if(!files || files.length === 0){
        let items = Array.from(e.dataTransfer.items)
        
        //NOTE: this probably doesn't work. need to look deeper into how to get this data
        /*if(arr.some(v => /^image\/.+/.test(v.type))){
            arr.filter(v => /^image\/.+/.test(v.type))[0].getAsString(loadData);
        } else {
        }*/
        if(items.some(v => v.type === 'text/uri-list')){
            items.filter(v => v.type === 'text/uri-list')[0].getAsString(loadUrl);
        }
    } else {
        files.forEach((file, i) =>{
            if(!file || !file.path){
                return console.warn('no path');
            }
            if(i === 0){
                loadFile(file.path);
            } else {
                loadInstance(file.path);
            }
        })
    }
}

function loadDirectory(dir, name){
    fs.lstat(dir, (err, stats) => {
        if(err){
            return console.error(err);
        }
        if(stats.isDirectory()){
            filename = name = '';
            filepath = dir = path.resolve(dir, '..');
        } else {
            filename = name = path.basename(dir);
            filepath = dir = path.resolve(dir, '..');
        }
        fs.readdir(dir, (err, list) => {
            if(err){
                return console.error(err);
            }
            localFiles = list;
            fileIndex = list.indexOf(name);
        });
    })
}

function nextFile(){
    if(context === 'file' || context === 'directory'){
        fileIndex = mod((fileIndex + 1), localFiles.length);
        loadFile(path.resolve(filepath, localFiles[fileIndex]), true);
    }
}

function prevFile(){
    if(context === 'file' || context === 'directory'){
        fileIndex = mod((fileIndex - 1), localFiles.length);
        loadFile(path.resolve(filepath, localFiles[fileIndex]), true);
    }
}

function nextMedia(){
    if(context === 'file' || context === 'directory'){
        let cycled = [...localFiles.slice(fileIndex), ...localFiles.slice(0,fileIndex)].slice(1);
        for(let i = 0; i < cycled.length; i++){
            if(MEDIA_EXTENSIONS.includes(cycled[i].split('.').pop())){
                fileIndex = mod((fileIndex + (i+1)), localFiles.length);
                loadFile(path.resolve(filepath, localFiles[fileIndex]), true);
                break;
            }
        }
    }
}

function prevMedia(){
    if(context === 'file' || context === 'directory'){
        let cycled = [...localFiles.slice(fileIndex), ...localFiles.slice(0,fileIndex)].slice(1).reverse();
        for(let i = 0; i < cycled.length; i++){
            if(MEDIA_EXTENSIONS.includes(cycled[i].split('.').pop())){
                fileIndex = mod((fileIndex - (i+1)), localFiles.length);
                loadFile(path.resolve(filepath, localFiles[fileIndex]), true);
                break;
            }
        }
    }
}

window.addEventListener('mousewheel', e => {
    checkMeta(e);
    if(shift){
        adjustOpacity(-e.deltaY);
    } else {
        if(alt){
            relZoom(-e.deltaY);
        } else {
            relZoomTarget(-e.deltaY, e.clientX, e.clientY);
        }
    }
});

function relZoom(dir){
    if(!curEl){
        return;
    }
    if(zoom === null){
        let scale = Math.min(curEl.clientWidth, curEl.clientHeight) / Math.min(width, height);
        if(scale >= 1){
            zoomStage = Math.round(scale) - 1;
        } else {
            zoomStage = 1 - Math.round(1/scale);
        }
    }
    if(dir < 0){
        zoomStage--;
    } else if(dir > 0) {
        zoomStage++;
    }
    
    updateZoom();
}

function relZoomTarget(dir, x, y){
    if(!curEl){
        return;
    }
    if(zoom === null){
        let scale = Math.min(curEl.clientWidth, curEl.clientHeight) / Math.min(width, height);
        if(scale >= 1){
            zoomStage = Math.round(scale) - 1;
        } else {
            zoomStage = 1 - Math.round(1/scale);
        }
    }
    if(dir < 0){
        zoomStage--;
    } else if(dir > 0) {
        zoomStage++;
    }

    let newZoom = zoom;
    if(zoomStage >= 0){
        newZoom = zoomStage + 1;
    } else {
        newZoom = 1 / (Math.abs(zoomStage) + 1);
    }

    panStartX = panX;
    panStartY = panY;

    let bounds = curEl.getBoundingClientRect(),
        centerX = bounds.x + bounds.width / 2,
        centerY = bounds.y + bounds.height / 2;

    let xDiff = x - centerX;
    let yDiff = y - centerY;
    if(dir < 0){
        xDiff *= -1;
        yDiff *= -1;
    }
    if((zoom < 1 && dir > 0) || (newZoom < 1 && dir < 0)){
        xDiff *= zoom * newZoom;
        yDiff *= zoom * newZoom;
    }
    let newWidth = width * newZoom,
        newHeight = height * newZoom;
    if(ctrl || windowLocked || (newWidth >= screenBounds.width || newHeight >= screenBounds.height)){
        ignoreReset.push(true);
        pan(-xDiff * 1/zoom, -yDiff * 1/zoom);
    } else {
        if(newWidth > MIN_WIDTH && newHeight > MIN_HEIGHT){
            panWindow(-xDiff * 1/zoom, -yDiff * 1/zoom);
        }
    }
    updateZoom();
}

function adjustOpacity(delta){
    if(delta > 0){
        delta = 0.1;
    } else if(delta < 0){
        delta = -0.1;
    }
    opacity = Math.max(0, Math.min(1, opacity + delta));
    containerEl.style.opacity = opacity;
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
    
    let newWidth = width * zoom,
        newHeight = height * zoom,
        clampedWidth = Math.round(Math.min(screenBounds.width, Math.max(MIN_WIDTH, newWidth))),
        clampedHeight = Math.round(Math.min(screenBounds.height, Math.max(MIN_HEIGHT, newHeight)));
    if(windowLocked){
        curEl.classList.remove('contain');
    } else {
        if(newWidth > MIN_WIDTH || newHeight > MIN_HEIGHT){
            curEl.classList.add('contain');
        } else {
            curEl.classList.remove('contain');
        }
    }
    
    curEl.setAttribute('width', newWidth);
    if(!windowLocked){
        if(curEl !== audEl){
            if(ctrl || newWidth > clampedWidth || newHeight > clampedHeight){
                curEl.classList.remove('contain');
            }
        }
    }
    if(!ctrl){
        if(window.outerWidth !== clampedWidth || window.outerHeight !== clampedHeight){
            ignoreResize.push(true);
            resizeWindow(clampedWidth, clampedHeight, true);
        }
        if((audEl !== curEl) && ignoreReset.length > 0){
            //ignoreReset.pop();
        } else {
            pan(panX = panStartX = 0, panY = panStartY = 0);
        }
    }
    ignoreReset.pop();
    recenter();
}

function resizeMax(){
    curEl.classList.remove('contain');
    let {width, height} = curEl.getBoundingClientRect();
    
    let a = Math.atan((curEl.clientHeight) / (curEl.clientWidth));
    
    width = (curEl.clientWidth)*Math.abs(Math.cos(a)) + (curEl.clientHeight)*Math.abs(Math.sin(a));
    height = width;
    
    width = Math.min(screenBounds.width, width);
    height = Math.min(screenBounds.height, height);
    
    resizeWindow(Math.round(width), Math.round(height), true);
}

function resizeWindow(w, h, center = false, onscreen = false){
    if(!windowLocked){
        ipcRenderer.send('resize', w, h, center, onscreen);
    }
}

window.addEventListener('resize', onResize);

function onResize(e){
    updateHelp();
    if(!curEl){
        return;
    }
    if(ignoreResize.length > 0){
        ignoreResize.pop();
    } else {
        curEl && curEl.classList.remove('pixel');
        if(ctrl){
            zoom = null;
            relZoom();
            curEl.classList.remove('contain');
        } else {
            curEl.classList.add('contain');
        }
    }
    recenter();
}

async function loadGifFrames(){
    if(loadedGifFrames) return loadedGifFrames;

    if(!loadedBuffer){
        await loadBuffer();
        if(!loadedBuffer){
            return;
        }
    }
    loadedGifFrames = await gifFrames({ url: loadedBuffer, frames: 'all', outputType: 'png', cumulative: true });
    //attempt to show current frame form playback
    /* curSeekFrame = 0;
    var acc = 0;
    accumulatedGifDelays = [];
    loadedGifFrames.forEach((v) => {
        acc += v.frameInfo.delay / 100;
        accumulatedGifDelays.push(acc);
    });
    var pos = Date.now() - playbackStart;
    pos = mod(pos, accumulatedGifDelays[accumulatedGifDelays.length-1]); //naively assumes looping gif
    for(i = 0; i < accumulatedGifDelays.length; i++){
        if(accumulatedGifDelays[i] >= pos){
            curSeekFrame = i;
            break;
        }
    } */
}

async function loadApngFrames(){
    if(loadedApngFrames) return loadedApngFrames;

    if(!loadedBuffer){
        await loadBuffer();
        if(!loadedBuffer){
            return;
        }
    }
    apngObj = apng(loadedBuffer);
    if(!apngCanvas){
        apngCanvas = new OffscreenCanvas(apngObj.width, apngObj.height);
    }
    apngPlayer = await apngObj.getPlayer(apngCanvas.getContext('2d'), false);
    loadedApngFrames = [];
}

async function seekFrame(delta = 1){
    if(!animated) return;
    cancelSync();
    if(curEl === vidEl){
        if(!frameRate){
            frameRate = vidEl.captureStream().getVideoTracks()[0].getSettings().frameRate;
        }
        if(!vidEl.paused){
            vidEl.pause();
        }
        if(Math.abs(delta) < 1){
            vidEl.currentTime =  mod(vidEl.currentTime + Math.sign(delta) * (1/60), vidEl.duration);
        } else {
            vidEl.currentTime = mod(vidEl.currentTime + delta * (1/frameRate), vidEl.duration);
        }
    } else if(mimeType == 'image/gif') {
        var start = false;
        if(!loadedGifFrames){
            start = true
        }
        await loadGifFrames()
        if(start){
            curSeekFrame = 0;
        } else {
            delta = Math.sign(delta) * 1;
            curSeekFrame = mod(curSeekFrame+delta, loadedGifFrames.length);
        }
        let png = loadedGifFrames[curSeekFrame].getImage();
        let chunks = [];
        png.on('data', function (chunk) {
            chunks.push(chunk);
        });
        png.on('end', function () {
            let result = Buffer.concat(chunks);
            curEl.src = `data:${'image/png'};base64,${result.toString('base64')}`;
            seeking = true;
        });
    } else if(mimeType == 'image/apng') {
        start = false;
        if(!loadedApngFrames){
            start = true
        }
        await loadApngFrames()
        if(start){
            curSeekFrame = 0;
            loadedApngFrames.push(await apngCanvas.convertToBlob());
        } else {
            delta = Math.sign(delta) * 1;
            curSeekFrame = mod(curSeekFrame+delta, apngObj.frames.length);
            if(curSeekFrame > loadedApngFrames.length-1){
                while(apngPlayer.currentFrameNumber < curSeekFrame){
                    apngPlayer.renderNextFrame();
                    loadedApngFrames.push(await apngCanvas.convertToBlob());
                }
            }
        }
        let png = loadedApngFrames[curSeekFrame];
        curEl.src = window.URL.createObjectURL(png);
        
        seeking = true;
    }
}

function cancelSync(){
    syncIndicatorEl.classList.remove('show');
    if(syncTimeoutId){
        clearTimeout(syncTimeoutId)
        syncTimeoutId = null;
    }
}

async function syncAnimation(){
    if(!animated) return;
    cancelSync();
    if(curEl === vidEl){
        vidEl.currentTime = mod(Date.now(), vidEl.duration * 1000.0) / 1000.0
        vidEl.play()
    } else if(mimeType == 'image/gif') {
        await loadGifFrames();
        let duration = 0.0;
        for(let frame of loadedGifFrames){
            duration += frame.frameInfo.delay * 10;
        }
        syncTimeoutId = setTimeout(function(){
            seeking = false;
            curSeekFrame = 0;
            curEl.src = loadedSource;
            syncIndicatorEl.classList.remove('show');
        }, duration - mod(Date.now(), duration))
        syncIndicatorEl.classList.add('show');
    } else if(mimeType == 'image/apng') {
        await loadApngFrames();
        let duration = 0.0;
        for(let frame of apngObj.frames){
            duration += frame.delay;
        }
        syncTimeoutId = setTimeout(function(){
            seeking = false;
            curSeekFrame = 0;
            curEl.src = loadedSource;
            syncIndicatorEl.classList.remove('show');
        }, duration - mod(Date.now(), duration))
        syncIndicatorEl.classList.add('show');
    }
}
