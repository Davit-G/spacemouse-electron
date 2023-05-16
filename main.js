/**
 * electron-hid-test main.js
 * github.com/todbot/electron-hid-test
 *
 * Demonstrate node-hid use in Electron renderer and Electron main
 */

const { app, BrowserWindow } = require('electron')

var HID = require('node-hid')

const { WebMidi } = require("webmidi");

let midiDeviceName = "IAC Driver Bus 1";



if (process.platform === 'linux') {
    app.disableHardwareAcceleration();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected
let win

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    // and load the index.html of the app.
    win.loadFile('index.html')

    // Open the DevTools.
    win.webContents.openDevTools({ mode: 'bottom' })



    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    })
}
app.commandLine.appendSwitch('disable-hid-blocklist')

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// console.log("HID devices:", HID.devices().map(d => { return { "p": d.product, "m": d.manufacturer } }));


let devices = HID.devices();

function joinInt16(min, maj) {
    var sign = maj & (1 << 7);
    var x = (((maj & 0xFF) << 8) | (min & 0xFF));
    if (sign) {
        x = 0xFFFF0000 | x;  // fill in most significant bits with 1's
    }
    return x;
}

// import lodash using require
let lodash = require('lodash');

const debouncedSendData = lodash.throttle((cc, value, out) => {
    out.sendControlChange(cc, value, {channels: [1]});
}, 10);

// const debouncedSendData = (cc, value, out) => {
//     out.sendControlChange(cc, value, {channels: [1]});
// }

useUpdatedMouseData = (data, out) => {
    
    if (data.rotate.x == null) return;
    if (data.translate.x == null) return;
    // console.log("aaa", data.translate.x)
    
    
    if (out) {
        let listOfStuff = [
            [data.translate.x, prevData.translate.x],
            [data.translate.y, prevData.translate.y],
            [data.translate.z, prevData.translate.z],
            [data.rotate.x, prevData.rotate.x],
            [data.rotate.y, prevData.rotate.y],
            [data.rotate.z, prevData.rotate.z]
        ]

        listOfStuff.forEach((dat, i) => {
            let v = dat[0];
            let pv = dat[1];

            if (v == null) return;
            if (pv == null) return;
            if (Math.abs(v - pv) < 0.05) return;

            value = Math.floor((v + 1) * 64);
            value = Math.max(0, Math.min(127, value))
            value = Math.floor(value)
            debouncedSendData(70 + i, value, out);

            
        });

        prevData = {
            translate: { ...data.translate },
            rotate: { ...data.rotate },
        };
    }

    translate.x = null;
    rotate.x = null;
}

const debouncedUpdatedMouseData = lodash.throttle(useUpdatedMouseData, 30);
// const debouncedUpdatedMouseData = useUpdatedMouseData



let translate = { x: null, y: 0, z: 0 };
let rotate = { x: null, y: 0, z: 0 };

let prevData = {
    translate: { x: null, y: 0, z: 0 },
    rotate: { x: null, y: 0, z: 0 },
};

const getMouseData = (data, out) => {
    // let buttons = (new Array(48).fill(false))

    if (data.length != 7) {
        console.log("bad data length:", data.length);
        return;
    }


    // data is a buffer right now
    // console.log(data[0], data[1], data[2], data[3], data[4], data[5], data[6])

    switch (data[0]) {
        case 1:
            translate.x = joinInt16(data[1], data[2]) / 350;
            translate.y = joinInt16(data[3], data[4]) / 350;
            translate.z = joinInt16(data[5], data[6]) / 350;
            break;
        case 2:
            rotate.x = joinInt16(data[1], data[2]) / 350;
            rotate.y = joinInt16(data[3], data[4]) / 350;
            rotate.z = joinInt16(data[5], data[6]) / 350;
            break;
        case 3:
            // data.slice(1, 7).forEach((buttonbyte, i) => {
            //     let si = i * 8;
            //     let mask = 1;
            //     for (let j = 0; j < 8; j++) {
            //         this.buttons[si + j] = ((mask << j) & buttonbyte) > 0;
            //     }
            // });
            break;
    }

    if (translate.x != null && rotate.x != null) {
        debouncedUpdatedMouseData({
            translate: translate,
            rotate: rotate,
        }, out);
    }
}

WebMidi.enable().then(() => {
    console.log(WebMidi.outputs)

    let midiOutput = null;

    WebMidi.outputs.forEach((output) => {
        if (output.name === midiDeviceName) {
            console.log("found " + midiDeviceName);
            midiOutput = output;
        }
    });

    for (let i = 0; i < devices.length; i++) {
        let d = devices[i];
        if (d.product == "SpaceMouse Compact") {
            try {
                var mouse = new HID.HID(d.path);
                mouse.on("data", (d) => {
                    getMouseData(d, midiOutput);
                });
                break;
            } catch (error) {
                console.log("error:", error);
            }
        }
    }

}).catch((err) => {
    console.log("WebMIDI not enabled", err)
});

