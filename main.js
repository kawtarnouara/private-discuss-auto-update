const {app, BrowserWindow, ipcMain, systemPreferences, protocol, Menu, ipcRenderer, desktopCapturer } = require('electron');

const { createWindow,  changeLang } = require('./windows');
const { initUpdater } = require('./updater');
const i18n = require('./configs/i18next.config');
const remoteMain = require("@electron/remote/main");
const { powerSaveBlocker } = require('electron');
let blockerId;
let dev = false;
app.getLocale()
let win;
let splash;
let result;
let mainurl;
let mainev;
remoteMain.initialize();
// Create window on electron intialization
if (process.platform === 'win32'){
    app.setAsDefaultProtocolClient('private-discuss');

    const primaryInstance = app.requestSingleInstanceLock();
    if (!primaryInstance) {
        app.quit();
        return;
    }

// The primary instance of the application will run this code, not the new  instance
    app.on('second-instance', (event, args) => {
        if (args.slice(1) && args.slice(1)[2]){
        mainurl = args.slice(1)[2]
        if(win){
            win.webContents.send('open-window', mainurl);
            mainurl = null;
            if(win.isMinimized()){
                win.restore();
            }
            win.focus();
        }
        }
    });
}

app.on('open-url', function (ev, url) {
    ev.preventDefault();
    mainev = ev; mainurl = url;
    if (app.isReady()){
        if(win){
            win.webContents.send('open-window', mainurl);
            mainurl = null;
            if(win.isMinimized()){
                win.restore();
            }
            win.focus();
        }
    }
});

app.on('ready', async () => {
    i18n.on('loaded', (loaded) => {
        const lang = ['en', 'fr', 'es', 'ar', 'de', 'it', 'nl', 'pl', 'pt', 'sv'].includes(app.getLocale()) ? app.getLocale() : 'fr';
        i18n.changeLanguage(lang);
        i18n.off('loaded');
    });

    i18n.on('languageChanged', (lng) => {
        changeLang(i18n, lng, win);

    });
    result = await createWindow(i18n, dev);
    // console.log('result ----------------' , result);
     console.log('token ----------------' , process.env.GH_TOKEN);
    splash = result.splash;
    if (process.platform === 'win32' &&  process.argv.slice(1) &&  process.argv.slice(1)[0]){
        mainurl = process.argv.slice(1)[0]
    }
    win = result.win;
    remoteMain.enable(win.webContents);
    win.webContents.on('did-finish-load', () => {
        if (mainurl) {
            event.preventDefault();
            let options = {
                 title: "Private Discuss",
                 modal: false,
                 // parent: win,
                 width: 1300,
                 height: 800,
                 minWidth: 500,
                 minHeight: 500,
                 webContents: "", // use existing webContents if provided
                 show: false
             }
             let new_win = new BrowserWindow(options)
             remoteMain.enable(new_win.webContents);
             new_win.once('ready-to-show', () => {
                // new_win.webContents.send('redirect-to-url', mainurl);
                 new_win.show()
                 if (dev) {
                     new_win.webContents.openDevTools();
                 }
             })
             // if (!options.webContents) {
             new_win.loadURL(mainurl) // existing webContents will be navigated automatically
             // }
             event.newGuest = new_win
          //  win.webContents.send('redirect-to-url', mainurl);
            mainurl = null;
        }
    });

});


app.on('before-quit', () => {
    BrowserWindow.getAllWindows().map(window => {
        window.destroy();
    });
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On macOS specific close process
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', async () => {
    // macOS specific close process
    console.log('ONBEFOREUNLOAD -----');
    // protocol.registerSchemesAsPrivileged([
    //     { scheme: 'file', privileges: { standard: true, supportFetchAPI: true, secure: true } }
    // ]);
    if (win === null) {
        win = await createMainWindow(dev)
    }
});

exports.setBadge = (count) => app.badgeCount = (count >= 0) ? count : 0;
exports.getPlatformName = () => process.platform;
exports.getVersionName = () => app.getVersion();
// AUTO UPDATER
// app.on('ready', function()  {
//   autoUpdater.checkForUpdates();
// });

let currentStatus = null;
console.error(__dirname);
ipcMain.on('change-language', (event, lang) => {
    changeLang(i18n, lang, win);
});
ipcMain.on('setBadge', (event, count) => {
    app.badgeCount = (count >= 0) ? count : 0
});
ipcMain.on('get-sources', async (event) => {
    //   const has_perms = systemPreferences.getMediaAccessStatus('screen');
     // console.log('has_perms', has_perms);
       const sources = (await desktopCapturer.getSources({ types: ['screen', 'window'] }))
         .map(({ name, id, thumbnail }) => ({ name, id, thumbnail: thumbnail.toDataURL() }));
       event.reply('get-sources-reply', sources);
});
ipcMain.on('online-status-changed', (event, status) => {
    console.log('on -----');
    // console.log(status);
    if (status === 'online' && currentStatus !== 'online') {
    currentStatus = 'online';
    splash.loadURL(`file://${__dirname}/assets/splash_private.html?connection=1`);
    console.info(`file://${__dirname}/dist/index.html`)
    win.loadURL(`file://${__dirname}/dist/index.html`);
    // win.loadURL(`https://piman.private-discuss.com`);
    win.once('ready-to-show',  () => {
        splash.destroy();
    win.show();
    currentStatus = null;
/*    const isAllowedMicrophone = await systemPreferences.askForMediaAccess('microphone');
    const isAllowedCamera = await systemPreferences.askForMediaAccess('camera');
    console.log("MICROHPHONE ALLOWED ------" + isAllowedMicrophone);
    console.log("Camera ALLOWED ------" + isAllowedCamera);*/
   // initUpdater(win);
});
} else if (status === 'offline' && currentStatus !== 'offline') {
    currentStatus = 'offline';
    splash.loadURL(`file://${__dirname}/assets/splash_private.html?connection=0`);
}
});

ipcMain.on('download-btn', (e, args) => {
    console.log('---- on download-btn');
    download(BrowserWindow.getFocusedWindow(), args.url)
.then(dl => {
    // console.log(dl.getSavePath());
})
.catch(console.error);
});

ipcMain.on("download", (event, info) => {
    console.log("ipcMain download triggerd");
});

ipcMain.on("powerSaveBlocker", (event, method) => {
    if (method === 'start') {
        blockerId = powerSaveBlocker.start('prevent-display-sleep');
    } else if (method === 'stop' && blockerId !== undefined) {
        powerSaveBlocker.stop(blockerId);
        blockerId = undefined;
    }
});

ipcMain.on("mouseMove", (event, mouseData) => {
    moveMouse(mouseData, null);
});

function moveMouse(mouseData, callback) {
    try {
        getMouseTarget(mouseData)
            .then(async (target) => {
                console.log("target 2" , target)
                await mouse.move(straightTo(target));
                console.log("target 3" , target)

                if (callback) {
                    callback();
                }
            })
            .catch(error => {
                // Handle errors here
                console.error(error);
            });

    } catch (e) {
        console.log('mouse error ', e)
    }
}

function getMouseTarget(mouseData) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("mouseData " , mouseData)
            const width = await screen.width();
            const height = await screen.height();
            const ratioX = width / mouseData.clientWidth
            const ratioY = height / mouseData.clientHeight

            const hostX = mouseData.clientX * ratioX
            const hostY = mouseData.clientY * ratioY
            const target = new Point(hostX, hostY);
            console.log("target " , target)
            resolve(target);
        } catch (e) {
            console.log('mouse error ', e);
            reject(e);
        }
    });
}


ipcMain.on("mouseDrag", (event, mouseData) => {
    try {
        getMouseTarget(mouseData)
            .then(async (target) => {
                await mouse.drag(straightTo(target));

            })
            .catch(error => {
                // Handle errors here
                console.error(error);
            });

    } catch (e) {
        console.log('mouse error ', e)
    }
});

ipcMain.on("mouseClick", (event, mouseData) => {
    const callback = (async () => {
        try {
            switch (mouseData.button) {
                case 'LEFT':
                    await mouse.leftClick();
                    break;
                case 'MIDDLE':
                    await mouse.click(Button.MIDDLE);
                    break;
                case 'RIGHT':
                    await mouse.rightClick();
                    break;
            }
            console.log('mouse click ', mouseData.button)
        } catch (e) {
            console.log('mouse error ', e)
        }

    });
    moveMouse(mouseData, callback);
});

ipcMain.on("mouseDoubleClick", (event, mouseData) => {
    const callback = (async () => {
        try {
            await mouse.click(Button.LEFT);
            switch (mouseData.button) {
                case 'LEFT':
                    await mouse.doubleClick(Button.LEFT);
                    break;
                case 'MIDDLE':
                    await mouse.doubleClick(Button.MIDDLE);
                    break;
                case 'RIGHT':
                    await mouse.doubleClick(Button.RIGHT);
                    break;
            }
        } catch (e) {
            console.log('mouse error ', e)
        }

    });
    moveMouse(mouseData, callback);

});


ipcMain.on("mouseScroll", (event, mouseData) => {
    const callback = (async () => {
        try {
            switch (mouseData.position) {
                case 'LEFT':
                    await mouse.scrollLeft(mouseData.amount);
                    break;
                case 'UP':
                    await mouse.scrollUp(mouseData.amount);
                    break;
                case 'DOWN':
                    await mouse.scrollDown(mouseData.amount);
                    break;
                case 'RIGHT':
                    await mouse.scrollRight(mouseData.amount);
                    break;
            }
        } catch (e) {
            console.log('mouse error ', e)
        }

    });
    moveMouse(mouseData, callback);
});

ipcMain.on("mouseRelease", (event, mouseData) => {
    const callback = (async () => {
        try {
            switch (mouseData.button) {
                case 'LEFT':
                    await mouse.releaseButton(Button.LEFT);
                    break;
                case 'MIDDLE':
                    await mouse.releaseButton(Button.MIDDLE);
                    break;
                case 'RIGHT':
                    await mouse.releaseButton(Button.RIGHT);
                    break;
            }
        } catch (e) {
            console.log('mouse error ', e)
        }

    });
    moveMouse(mouseData, callback);

});

ipcMain.on("mousePress", (event, mouseData) => {
    const callback = (async () => {
        try {
            switch (mouseData.button) {
                case 'LEFT':
                    await mouse.pressButton(Button.LEFT);
                    break;
                case 'MIDDLE':
                    await mouse.pressButton(Button.MIDDLE);
                    break;
                case 'RIGHT':
                    await mouse.pressButton(Button.RIGHT);
                    break;
            }
        } catch (e) {
            console.log('mouse error ', e)
        }

    });
    moveMouse(mouseData, callback);
});

ipcMain.on("keyboardPress", (event, keyboardData) => {
    (async () => {
        try {
            await keyboard.pressKey(keyboardData.input);
        } catch (e) {
            console.log('mouse error ', e)
        }

    })();
});

ipcMain.on("keyboardRelease", (event, keyboardData) => {
    (async () => {
        try {
            await keyboard.releaseKey(keyboardData.input, Key.L);
        } catch (e) {
            console.log('mouse error ', e)
        }

    })();
});

ipcMain.on("keyboardType", (event, keyboardDatas) => {
    (async () => {
        for (const keyboardData of keyboardDatas) {
            try {
                const stringKey = keyboardData.key === keyboardData.key.toUpperCase() ? keyboardData.key : mapKeyEventToNutJS(keyboardData, !/shift|meta|alt|cmd/.test(keyboardData.code.toLowerCase()));
                const key = mapKeyEventToNutJS(keyboardData, false);
                console.log("stringKey ", stringKey);
                if (stringKey) {
                    await keyboard.type(stringKey);
                } else if (keyboardData.shiftKey) {
                    await keyboard.pressKey(Key.RightShift, key);
                    await keyboard.releaseKey(Key.RightShift, key);
                } else if (keyboardData.ctrlKey || keyboardData.metaKey) {
                    await keyboard.pressKey(Key.RightControl, key);
                    await keyboard.releaseKey(Key.RightControl, key);
                } else if (keyboardData.altKey) {
                    console.log("key alt", key);
                    await keyboard.pressKey(Key.RightAlt, key);
                    await keyboard.releaseKey(Key.RightAlt, key);
                }
            } catch (e) {
                console.log('key error', e)
            }
        }
    })();

});

function mapKeyEventToNutJS(keyEvent, canBeString) {
    return AsciiToNutJSMapping[keyEvent.key] || (canBeString && keyEvent.key !== "Dead" ? keyEvent.key : null);
}
