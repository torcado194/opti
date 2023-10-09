const electron = require('electron');
const {app, BrowserWindow, ipcMain, webContents} = electron;

let screen;
let screenBounds;

if(process.env.NODE_ENV === 'development'){
    require('electron-reload')(__dirname);
}

let minWidth = 120,
    minHeight = 120;

process.env.MIN_WIDTH = minWidth;
process.env.MIN_HEIGHT = minHeight;

function createWindow(file){
    let win = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth,
        minHeight,
        transparent: true,
        backgroundColor: '#00000000',
        resizable: true,
        icon: __dirname + '/icon.png',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            zoomFactor: 1.0
        },
        frame: false,
        skipTaskbar: false,
        autoHideMenuBar: true
    });
    win.loadFile('src/index.html');
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('open', file ? [0, file] : process.argv);
    });
    win.on('closed', () => {
        win = null;
    });
    screen = electron.screen;
    getBounds();
}

app.commandLine.appendSwitch('high-dpi-support', 1);
app.commandLine.appendSwitch('force-device-scale-factor', 1);

app.on('ready', (e) => {
    if(process.platform === 'linux'){
        setTimeout(()=>{
            createWindow();
        }, 300);
    } else {
        createWindow();
    }
});

function getBounds(){
    screenBounds = screen.getPrimaryDisplay().bounds;
    let displays = screen.getAllDisplays();
    displays.forEach(display => {
        if(display === screen.getPrimaryDisplay()) return;
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
}

ipcMain.on('new', (e, file) => {
    createWindow(file);
});

ipcMain.on('reload', (e, file) => {
    createWindow(file);
    let win = e.sender.getOwnerBrowserWindow();
    win.close();
    win = null;
});

ipcMain.on('resize', (e, w, h, center = false, onscreen = false) => {
    let win = e.sender.getOwnerBrowserWindow();
    let [oldW, oldH] = win.getSize(),
        [oldX, oldY] = win.getPosition();
    win.setSize(w, h);
    if(center){
        let {width, height} = screen.getPrimaryDisplay().workAreaSize;
        w = Math.max(minWidth, Math.min(w, width + 20));
        h = Math.max(minHeight, Math.min(h, height + 60));
        let newX = oldX + Math.floor((oldW - w) / 2),
            newY = oldY + Math.floor((oldH - h) / 2);
        if(onscreen){
            win.setPosition(Math.max(screenBounds.x,Math.min(screenBounds.width - w, newX)), Math.max(screenBounds.y,Math.min(screenBounds.height - h, newY)));
        } else {
            win.setPosition(newX, newY);
        }
    }
});

ipcMain.on('windowMoving', (e, startX, startY, filename) => {
    //console.log('ccc');
    let win = e.sender.getOwnerBrowserWindow();
    const { x, y } = electron.screen.getCursorScreenPoint();
    win.setPosition(x - startX, y - startY);
});

ipcMain.on('windowMoved', () => {
    
});

ipcMain.on('panWindow', (e, dx, dy) => {
    //console.log('ccc');
    let win = e.sender.getOwnerBrowserWindow();
    const [ x, y ] = win.getPosition();
    win.setPosition(Math.round(x + dx), Math.round(y + dy));
});

ipcMain.on('setAlwaysOnTop', (e, state) => {
    let win = e.sender.getOwnerBrowserWindow();
    win.setAlwaysOnTop(state);
});

ipcMain.on('setPassthrough', (e, state) => {
    let win = e.sender.getOwnerBrowserWindow();
    win.setIgnoreMouseEvents(state);
});

ipcMain.on('getCursorPosition', (e) => {
    let win = e.sender.getOwnerBrowserWindow();
    const { x, y } = electron.screen.getCursorScreenPoint(),
          [winX, winY] = win.getPosition();
    e.returnValue = {x: x - winX, y: y - winY};
    //win.webContents.send('mousemove', , );
});