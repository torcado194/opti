const electron = require('electron');
const {app, BrowserWindow, ipcMain} = electron;

let screen;

if(process.env.NODE_ENV === 'development'){
    require('electron-reload')(__dirname);
}

let win,
    minWidth = 120,
    minHeight = 120,
    centerX = 0,
    centerY = 0;

process.env.MIN_WIDTH = minWidth;
process.env.MIN_HEIGHT = minHeight;

function createWindow(){
    win = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth,
        minHeight,
        transparent: true,
        backgroundColor: '#00000000',
        resizable: true,
        icon: __dirname + '/icon.ico',
        webPreferences: {
            nodeIntegration: true,
            zoomFactor: 1.0
        },
        frame: false,
        skipTaskbar: false,
        autoHideMenuBar: true
    });
    win.loadFile('src/index.html');
    //win.setIgnoreMouseEvents(true, {forward: true});
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('open', process.argv[1]);
    });
    win.on('closed', () => {
        win = null
    });
    
    screen = electron.screen;
    
    [centerX, centerY] = win.getPosition();
}

app.on('ready', createWindow);


ipcMain.on('resize', (e, w, h, center) => {
    let [oldW, oldH] = win.getSize(),
        [oldX, oldY] = win.getPosition();
    if(center){
        let {width, height} = screen.getPrimaryDisplay().workAreaSize;
        w = Math.max(minWidth, Math.min(w, width + 20));
        h = Math.max(minHeight, Math.min(h, height + 60));
        //console.log(w, oldW, h, oldH);
        win.setPosition(oldX + Math.round((oldW - w) / 2), oldY + Math.round((oldH - h) / 2));
        
        //let x = Math.round(centerX - w/2);
        //let y = Math.round(centerY - h/2);
        //win.setPosition(x, y);
    }
    win.setSize(w, h);
});

ipcMain.on('windowMoving', (e, startX, startY) => {
    const { x, y } = electron.screen.getCursorScreenPoint();
    win.setPosition(x - startX, y - startY);
    centerX = x - startX / 2;
    centerY = y - startY / 2;
});

ipcMain.on('windowMoved', () => {
    
});

ipcMain.on('setAlwaysOnTop', (e, state) => {
    console.log({state});
    win.setAlwaysOnTop(state);
});

ipcMain.on('setClickthrough', (e, state) => {
    win.setIgnoreMouseEvents(state, {forward: true})
});