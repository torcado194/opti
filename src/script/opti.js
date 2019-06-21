const {ipcRenderer} = require('electron');

let canDrag = false,
    imgEl,
    vidEl,
    curEl,
    width = 0,
    height = 0,
    zoomStage = 0,
    zoom = 1,
    ignoreResize = [],
    filePath;

function init(){
    console.log('ready');
    
    ipcRenderer.send('resize', 500, 500);
    
    curEl = imgEl = document.getElementById('image');
    vidEl = document.getElementById('video');
    
    console.log(screen);
    
    /*window.addEventListener('keydown', e => {
        if(e.key === 'Shift'){
            canDrag = true;
            document.getElementById('drag').style.display = 'block';
        }
    });
    window.addEventListener('keyup', e => {
        if(e.key === 'Shift'){
            canDrag = false;
            document.getElementById('drag').style.display = 'none';
        }
    });*/
    
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



function load(data){
    let mime;
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
    zoom = 1;
    zoomStage = 0;
}

function loadDone(){
    if(curEl === imgEl){
        width = curEl.naturalWidth;
        height = curEl.naturalHeight;
    } else if(curEl === vidEl) {
        width = curEl.videoWidth;
        height = curEl.videoHeight;
    }
    ipcRenderer.send('resize', width, height);
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
        load(e.target.result);
    }
    reader.readAsDataURL(file);
}

window.addEventListener('mousewheel', onMouseWheel);

function onMouseWheel(e){
    if(zoom < 1 || true){
        let scale = Math.min(curEl.clientWidth, curEl.clientHeight) / Math.min(width, height);
        console.log(scale);
        if(scale >= 1){
            zoomStage = Math.round(scale) - 1;
        } else {
            zoomStage = 1 - Math.round(1/scale);
        }
    }
    if(e.deltaY > 0){
        zoomStage--;
    } else {
        zoomStage++;
    }
    
    if(zoomStage >= 0){
        zoom = zoomStage + 1;
        curEl.classList.add('pixel');
    } else {
        zoom = 1 / (Math.abs(zoomStage) + 1);
        curEl.classList.remove('pixel');
    }
    
    let newWidth = Math.min(screen.availWidth, width * zoom);
    let newHeight = Math.min(screen.availHeight, height * zoom);
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
    zoom = 0;
    curEl.classList.remove('pixel');
}