const {ipcRenderer} = require('electron');

let canDrag = false;

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
    mouseX = e.clientX;  
    mouseY = e.clientY;
    
    document.addEventListener('mouseup', onMouseUp)
    requestAnimationFrame(moveWindow);
}

function onMouseUp(e) {
    ipcRenderer.send('windowMoved');
    document.removeEventListener('mouseup', onMouseUp)
    cancelAnimationFrame(animationId)
}

function moveWindow() {
    ipcRenderer.send('windowMoving', { mouseX, mouseY });
    animationId = requestAnimationFrame(moveWindow);
}



function load(data){
    document.getElementById('image').setAttribute('src', data);
}

window.addEventListener('dragover', drag);
window.addEventListener('drop', drop);

function drag(e){
    console.log(e);
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