const electron = require('electron');
const {app, BrowserWindow, ipcMain, webContents} = electron;
const fs = require("fs");
const path = require('path');

let screen;
let screenBounds;
let reloading = false;

if(process.env.NODE_ENV === 'development'){
    require('electron-reload')(__dirname);
}

let minWidth = 120,
    minHeight = 120;

process.env.MIN_WIDTH = minWidth;
process.env.MIN_HEIGHT = minHeight;

const instances = [];

function getArgs(argv){
    if(!Array.isArray(argv)){
        argv = argv.split(" ");
    }
    let args = [];

    for(let v of argv){
        if(typeof v === 'string' && v.startsWith("--")){
            continue
        }
        args.push(v);
    }

    return args;
}

function createWindow(argv){
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
        reloading = false;
        let args = getArgs(argv ? argv : process.argv);
        win.webContents.send('open', args);
    });
    win.on('closed', () => {
        win = null;
    });
    instances.push(win);
}

app.commandLine.appendSwitch('high-dpi-support', 1);
app.commandLine.appendSwitch('force-device-scale-factor', 1);
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');


const locked = app.requestSingleInstanceLock();
let cmdQPressed = false;
if (!locked) {
    app.quit();
} else {
    app.on('second-instance', (event, argv, workingDirectory) => {
        createWindow(argv);
    });
    app.on('ready', (e) => {
        console.log("ready");
        if(process.platform === 'linux'){
            setTimeout(()=>{
                createWindow();
            }, 300);
        } else {
            createWindow();
        }
        screen = electron.screen;
        getBounds();
    });
    if (process.platform === 'darwin') {
        // Quit from the dock context menu should quit the application directly
        app.on('before-quit', () => {
            cmdQPressed = true;
        });
    }
    app.on('window-all-closed', () => {
        if (cmdQPressed || process.platform !== 'darwin') {
            app.quit();
        }
    });
    
    app.on('activate', () => createWindow());
}

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
    createWindow(["", file]);
});

ipcMain.on('reload', (e, file) => {
    if(reloading){
        return;
    }
    reloading = true
    createWindow(["", file]);
    let win = e.sender.getOwnerBrowserWindow();
    win.close();
    win = null;
});

const debounce = (callback, wait) => {
    let timeoutId = null;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            callback(...args);
        }, wait);
    };
}

ipcMain.on('getData', (e, key) => {
    e.returnValue = getData(key);
});
function getData(key) {
    let file = path.join(app.getPath('userData'), 'data.json');
    if(!fs.existsSync(file)){
        fs.writeFileSync(file, JSON.stringify({}));
    }
    let data = JSON.parse(fs.readFileSync(file));
    if(key){
        return data[key];
    } else {
        return data;
    }
}

ipcMain.on('setData', (e, key, value) => {
    setDataDebounce(key, value);
});
function setData(key, value) {
    let file = path.join(app.getPath('userData'), 'data.json');
    let data = getData();
    data[key] = value;

    fs.writeFileSync(file, JSON.stringify(data));
}
const setDataDebounce = debounce(setData, 200);

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
    let win = e.sender.getOwnerBrowserWindow();
    const { x, y } = electron.screen.getCursorScreenPoint();
    win.setPosition(x - startX, y - startY);
});

ipcMain.on('windowMoved', () => {
    
});

ipcMain.on('panWindow', (e, dx, dy) => {
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

ipcMain.on('getCursorPosition', (e, global = false) => {
    let win = e.sender.getOwnerBrowserWindow();
    const { x, y } = electron.screen.getCursorScreenPoint()
    if(global) {
        e.returnValue = {x: x, y: y};
    } else {
        const [winX, winY] = win.getPosition();
        e.returnValue = {x: x - winX, y: y - winY};
    }
});