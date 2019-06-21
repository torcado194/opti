const electron = require('electron');
const {app, BrowserWindow, ipcMain} = electron;

let screen;

require('electron-reload')(__dirname);

let win;

function createWindow(){
    win = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 40,
        minHeight: 40,
        transparent: true,
        resizable: true,
        //icon: __dirname + '/icon.png',
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


ipcMain.on('resize', (e, w, h) => {
    win.setSize(w, h);
});

ipcMain.on('windowMoving', (e, {mouseX, mouseY}) => {
    const { x, y } = electron.screen.getCursorScreenPoint()
    win.setPosition(x - mouseX, y - mouseY)
});

ipcMain.on('windowMoved', () => {
// Do somehting when dragging stop
});