const {ipcRenderer} = require('electron');

let canDrag = false,
    imgEl,
    width = 0,
    height = 0,
    zoom = 1;

function init(){
    console.log('ready');
    
    ipcRenderer.send('resize', 500, 500);
    
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
    console.log(e);
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
    console.log(e);
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
    imgEl = document.getElementById('image');
    imgEl.setAttribute('src', data);
    imgEl.onload = loadDone;
    zoom = 1;
}

function loadDone(){
    width = imgEl.naturalWidth;
    height = imgEl.naturalHeight;
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
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if(!file || !file.name){
        return console.warn('no file');
    }
    const reader = new FileReader();
    reader.onload = function(e){
        load(e.target.result);
    }
    reader.readAsDataURL(file);
}

window.addEventListener('mousewheel', onMouseWheel);

function onMouseWheel(e){
    console.log(e);
    if(e.deltaY > 0){
        zoom = Math.max(1, zoom - 1);
    } else {
        zoom++;
    }
    imgEl.setAttribute('width', width * zoom);
    imgEl.classList.add('pixel');
    ipcRenderer.send('resize', width * zoom, height * zoom);
}

window.addEventListener('resize', onResize);

function onResize(e){
    imgEl.classList.remove('pixel');
}