const electron = require('electron');
const {app, BrowserWindow, ipcMain} = electron;

let screen;

require('electron-reload')(__dirname);

let win,
    minWidth = 120,
    minHeight = 120;

process.env.MIN_WIDTH = minWidth;
process.env.MIN_HEIGHT = minHeight;

function createWindow(){
    win = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth,
        minHeight,
        transparent: true,
        resizable: true,
        icon: __dirname + '/icon.png',
        webPreferences: {
            nodeIntegration: true,
            zoomFactor: 1.0
        },
        frame: false,
        skipTaskbar: false,
        autoHideMenuBar: true
    });
    win.loadFile('src/index.html');
    win.on('closed', () => {
        win = null
    });
    screen = electron.screen;
}

app.on('ready', createWindow);


ipcMain.on('resize', (e, w, h, center) => {
    let [oldW, oldH] = win.getSize(),
        [oldX, oldY] = win.getPosition();
    win.setSize(w, h);
    if(center){
        let {width, height} = screen.getPrimaryDisplay().workAreaSize;
        w = Math.max(minWidth, Math.min(w, width + 20));
        h = Math.max(minHeight, Math.min(h, height + 60));
        console.log(w, oldW, h, oldH);
        win.setPosition(oldX + Math.floor((oldW - w) / 2), oldY + Math.floor((oldH - h) / 2));
    }
});

ipcMain.on('windowMoving', (e, startX, startY) => {
    const { x, y } = electron.screen.getCursorScreenPoint();
    win.setPosition(x - startX, y - startY);
});

ipcMain.on('windowMoved', () => {
    
});

ipcMain.on('setAlwaysOnTop', (e, state) => {
    console.log({state});
    win.setAlwaysOnTop(state);
});