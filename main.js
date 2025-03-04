const {app, dialog, Tray, Menu} = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
const https = require('https');
const platform = require('os').platform();
const crypto = require('crypto');
const Store = require('electron-store');
const settings = new Store({name: 'Settings'});
const log = require('electron-log');
const splash = require('@trodi/electron-splashscreen');
const config = require('./src/js/ws_config');

const IS_DEV  = (process.argv[1] === 'dev' || process.argv[2] === 'dev');
const IS_DEBUG = IS_DEV || process.argv[1] === 'debug' || process.argv[2] === 'debug';
const LOG_LEVEL = IS_DEBUG ? 'debug' : 'warn';
const WALLET_CFGFILE = path.join(app.getPath('userData'), 'wconfig.txt');

log.transports.console.level = LOG_LEVEL;
log.transports.file.level = LOG_LEVEL;
log.transports.file.maxSize = 5 * 1024 * 1024;

const WALLETSHELL_VERSION = config.electronVersion;
log.info(`Starting Electron WalletShell v${WALLETSHELL_VERSION}`);
log.info(`Starting Dynex Wallet v${config.walletVersion}`);

const SERVICE_FILENAME =  ( platform === 'win32' ? `${config.walletServiceBinaryFilename}.exe` : config.walletServiceBinaryFilename );
const NODE_FILENAME =  ( platform === 'win32' ? `${config.walletNodeBinaryFilename}.exe` : config.walletNodeBinaryFilename );
const DEFAULT_SERVICE_BIN = path.join(
	app.getAppPath(),
	'..', '..', // Move out of app.asar due to electron compiling
	'resources',
	'dnx',
	SERVICE_FILENAME
);
const DEFAULT_NODE_BIN = path.join(
	app.getAppPath(),
	'..', '..', // Move out of app.asar due to electron compiling
	'resources',
	'dnx',
	NODE_FILENAME
);

const DEFAULT_SETTINGS = {
    service_bin: DEFAULT_SERVICE_BIN,
    node_bin: DEFAULT_NODE_BIN,
    service_host: config.remoteNodeDefaultHost,
    service_port: config.walletServiceRpcPort,
    service_password: crypto.randomBytes(32).toString('hex'),
    daemon_host: config.remoteNodeDefaultHost,
    daemon_port: config.daemonDefaultRpcPort,
    language: 'en',
    wrapped_addr: '',
    qnode_subgrp: '',
    pubnodes_date: null,
    pubnodes_data: config.remoteNodeListFallback,
    pubnodes_custom: ['node.dynexcoin.org:18333'],
    tray_minimize: false,
    tray_close: false
};

const DEFAULT_SIZE = {
    width: 1280,
    height: IS_DEBUG ? 1000 : 900
};

app.prompExit = true;
app.prompShown = false;
app.needToExit = false;
app.setAppUserModelId(config.appId);

let trayIcon = path.join(__dirname,'src/assets/tray.png');
let trayIconHide = path.join(__dirname,'src/assets/trayon.png');

let win;
let tray;

function runPostInstall() {
    const installFlag = path.join(app.getPath('userData'), '.installed');    
    if (fs.existsSync(installFlag)) return;
    const scriptPath = path.join(app.getPath('userData'), 'postinstall.sh');    
    const stream = fs.createWriteStream(scriptPath, { mode: 0o755 });
    stream.write(`#!/bin/bash

# Ensure the script is run with root privileges
if [ "$EUID" -ne 0 ]; then 
    echo "Error: Please run this script with sudo or as root."
    exit 1
fi

# Define paths
INSTALL_DIR="/opt/dynex-wallet"
LIB_DIR="/usr/local/lib"
BIN_DIR="/usr/local/bin"
APP_RESOURCES="$APPDIR/resources/dnx"

# Create necessary directories
echo "Creating installation directories..."
mkdir -p "$INSTALL_DIR" || { echo "Failed to create $INSTALL_DIR"; exit 1; }
mkdir -p "$LIB_DIR" || { echo "Failed to create $LIB_DIR"; exit 1; }

# Copy files
echo "Copying files..."
cp -f "$APP_RESOURCES/DNX-service" "$INSTALL_DIR/" || { echo "Failed to copy DNX-service"; exit 1; }
cp -f "$APP_RESOURCES/DNX-node" "$INSTALL_DIR/" || { echo "Failed to copy DNX-node"; exit 1; }
cp -f "$APP_RESOURCES/libcurl.so.4" "$LIB_DIR/" || { echo "Failed to copy libcurl.so.4"; exit 1; }
cp -f "$APP_RESOURCES/libboost_filesystem.so.1.74.0" "$LIB_DIR/" || { echo "Failed to copy libboost_filesystem"; exit 1; }
cp -f "$APP_RESOURCES/libboost_program_options.so.1.74.0" "$LIB_DIR/" || { echo "Failed to copy libboost_program_options"; exit 1; }
cp -f "$APP_RESOURCES/libz.so.1" "$LIB_DIR/" || { echo "Failed to copy libz"; exit 1; }

# Set permissions
echo "Setting permissions..."
chmod +x "$INSTALL_DIR/DNX-service" || { echo "Failed to set execute permission on DNX-service"; exit 1; }
chmod +x "$INSTALL_DIR/DNX-node" || { echo "Failed to set execute permission on DNX-node"; exit 1; }
chmod 755 "$LIB_DIR/libcurl.so.4" || { echo "Failed to set permissions on libcurl.so.4"; exit 1; }
chmod 755 "$LIB_DIR/libboost_filesystem.so.1.74.0" || { echo "Failed to set permissions on libboost_filesystem"; exit 1; }
chmod 755 "$LIB_DIR/libboost_program_options.so.1.74.0" || { echo "Failed to set permissions on libboost_program_options"; exit 1; }
chmod 755 "$LIB_DIR/libz.so.1" || { echo "Failed to set permissions on libz"; exit 1; }

# Update dynamic linker cache
echo "Updating dynamic linker cache..."
ldconfig || { echo "ldconfig failed"; exit 1; }

# Create symbolic links
echo "Creating symbolic links..."
ln -sf "$INSTALL_DIR/DNX-service" "$BIN_DIR/DNX-service" || { echo "Failed to create symbolic link for DNX-service"; exit 1; }
ln -sf "$INSTALL_DIR/DNX-node" "$BIN_DIR/DNX-node" || { echo "Failed to create symbolic link for DNX-node"; exit 1; }

echo "Installation completed successfully!"
`);
    stream.end();

    dialog.showMessageBox({
        type: 'info',
        title: 'Dynex Wallet Installation',
        message: 'The wallet will now perform its initial setup. You may need to enter your password to proceed.',
        buttons: ['OK', 'Cancel']
    }).then(result => {
        if (result.response === 0) {
            const { exec } = require('child_process');
            exec(`sudo bash "${scriptPath}"`, (error, stdout, stderr) => {
                if (error) {
                    dialog.showErrorBox('Installation Error', 
                        `Failed to complete the setup. Error: ${stderr || error.message}`);
                    return;
                }
                fs.writeFileSync(installFlag, '');

                dialog.showMessageBox({
                    type: 'info',
                    title: 'Setup Complete',
                    message: 'Initial setup has been completed successfully.'
                });
            });
        }
    });
}


function createWindow () {
    // Create the browser window.
    const winOpts = {
        title: `${config.appDescription}`,
        icon: path.join(__dirname,'src/assets/walletshell_icon.png'),
        frame: true,
        width: DEFAULT_SIZE.width,
        height: DEFAULT_SIZE.height,
        minWidth: DEFAULT_SIZE.width,
        minHeight: DEFAULT_SIZE.height,
        show: false,
        backgroundColor: '#02853E',
        center: true,
    };

    win = splash.initSplashScreen({
        windowOpts: winOpts,
        templateUrl: path.join(__dirname, "src/html/splash.html"),
        delay: 0, 
        minVisible: IS_DEBUG ? 0 : 3500,
        splashScreenOpts: {
            width: 728,
            height: 446,
            transparent: true
        },
    });

    if (platform !== 'darwin') {
        let contextMenu = Menu.buildFromTemplate([
            { label: 'Minimize to tray', click: () => { win.hide(); } },
            {
                label: 'Quit', click: () => {
                    app.needToExit = true;
                    if (win) {
                        win.close();
                    } else {
                        process.exit(0);
                    }
                }
            }
        ]);

        tray = new Tray(trayIcon);
        tray.setPressedImage(trayIconHide);
        tray.setTitle(config.appName);
        tray.setToolTip(config.appSlogan);
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (settings.get('tray_minimize', false)) {
                if (win.isVisible()) {
                    win.hide();
                } else {
                    win.show();
                }
            } else {
                if (win.isMinimized()) {
                    win.restore();
                    win.focus();
                } else {
                    win.minimize();
                }
            }
        });

        win.on('show', () => {
            tray.setHighlightMode('always');
            tray.setImage(trayIcon);
            contextMenu = Menu.buildFromTemplate([
                { label: 'Minimize to tray', click: () => { win.hide(); } },
                {
                    label: 'Quit', click: () => {
                        app.needToExit = true;
                        win.close();
                    }
                }
            ]);
            tray.setContextMenu(contextMenu);
            tray.setToolTip(config.appSlogan);
        });

        win.on('hide', () => {
            tray.setHighlightMode('never');
            tray.setImage(trayIconHide);
            if (platform === 'darwin') return;

            contextMenu = Menu.buildFromTemplate([
                { label: 'Restore', click: () => { win.show(); } },
                {
                    label: 'Quit', click: () => {
                        app.needToExit = true;
                        win.close();
                    }
                }
            ]);
            tray.setContextMenu(contextMenu);
        });

        win.on('minimize', (event) => {
            if (settings.get('tray_minimize') && platform !== 'darwin') {
                event.preventDefault();
                win.hide();
            }
        });
    }

    //load the index.html of the app.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'src/html/index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // open devtools
    if(IS_DEV) win.webContents.openDevTools();

    // show windosw
    win.once('ready-to-show', () => {
        win.setTitle(`${config.appDescription}`);
        if (platform !== 'darwin') {
            tray.setToolTip(config.appSlogan);
        }
    });

    win.on('close', (e) => {
        if(settings.get('tray_close') && !app.needToExit && platform !== 'darwin'){
            e.preventDefault();
            win.hide();
        }else if(app.prompExit ){
            e.preventDefault();
            if(app.prompShown) return;
            let msg = 'Are you sure want to exit?';
            app.prompShown = true;
            dialog.showMessageBox({
                type: 'question',
                buttons: ['Yes', 'No'],
                title: 'Exit Confirmation',
                message: msg
            }, function (response) {
                app.prompShown = false;
                if (response === 0) {
                    app.prompExit = false;
                    win.webContents.send('cleanup','Cleanup');
                }else{
                    app.prompExit = true;
                    app.needToExit = false;
                }
            });
        }
    });
    
    win.on('closed', () => {
        win = null;
    });

    win.setMenu(null);

    // misc handler
    win.webContents.on('crashed', () => { 
        // todo: prompt to restart
        log.debug('webcontent was crashed');
    });

    win.on('unresponsive', () => {
        // todo: prompt to restart
        log.debug('webcontent is unresponsive');
    });
}

function storeNodeList(pnodes){
    pnodes = pnodes || settings.get('pubnodes_data');
    let validNodes = [];
    if( pnodes.hasOwnProperty('nodes')){
        pnodes.nodes.forEach(element => {
            let item = `${element.url}:${element.port}`;
            validNodes.push(item);
        });
    }
    if(validNodes.length) settings.set('pubnodes_data', validNodes);
}
function serviceConfigFormatCheck(){
    let serviceBin = settings.get('service_bin', false);
    let semver = require('semver');
    require('child_process').execFile(
        serviceBin, ["--version"], (error, stdout) => {
            if(error){
                console.log(error);
                settings.set('configFormat', 'ini');
                return;
            }

            try{
                let verout = stdout.trim();
                let version = verout.split(' ')[1];
                if(!version){
                    version = verout.slice(
                        verout.indexOf(config.assetName),
                        verout.indexOf('(')
                    );
                }
                version = semver.coerce(version.trim());
                settings.set(
                    'configFormat', 
                    semver.lt('0.8.4', version) ? 'json' : 'ini'
                );
                log.info(
                    `Service version: ${version}, config format: ${settings.get('configFormat')}`
                );
            }catch(_e){}
        }
    );
}

app.checkUpdateConfig = serviceConfigFormatCheck;

function initSettings(){
    Object.keys(DEFAULT_SETTINGS).forEach((k) => {
        if(!settings.has(k) || settings.get(k) === null){
            settings.set(k, DEFAULT_SETTINGS[k]);
        }
    });
    settings.set('service_password', crypto.randomBytes(32).toString('hex'));
    settings.set('version', WALLETSHELL_VERSION);
}

const silock = app.requestSingleInstanceLock();

if (!silock) {
    app.on('ready', () => {
        dialog.showMessageBox({
            type: 'info',
            title: config.appName,
            message: `${config.appName} is already running.`,
            detail: platform === 'darwin' ? 
                'Only one instance of the wallet can be active at a time.\nCheck your dock or menu bar for the existing window.' :
                'Only one instance of the wallet can be active at a time.\nThe existing instance has been brought to focus.',
            buttons: ['OK'],
            icon: path.join(__dirname,'src/assets/walletshell_icon.png')
        }).then(() => {
            app.quit();
        });
    });
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (win) {
            if (!win.isVisible()) win.show();
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });
    app.on('ready', () => {
        initSettings();
        if(IS_DEV || IS_DEBUG) log.warn(`Running in ${IS_DEV ? 'dev' : 'debug'} mode`);
        global.wsession = { debug: IS_DEBUG };
        // runPostInstall();     
        createWindow();
        let eScreen = require('electron').screen;
        let primaryDisp = eScreen.getPrimaryDisplay();
        let tx = Math.ceil((primaryDisp.workAreaSize.width - DEFAULT_SIZE.width)/2);
        let ty = Math.ceil((primaryDisp.workAreaSize.height - (DEFAULT_SIZE.height))/2);
        if(tx > 0 && ty > 0) win.setPosition(parseInt(tx, 10), parseInt(ty,10));
    });
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    //if (platform !== 'darwin')
    app.quit();
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) createWindow();
});

process.on('uncaughtException', function (e) {
    log.error(`Uncaught exception: ${e.message}`);
    try { fs.unlinkSync(WALLET_CFGFILE); } catch (e) { }
    process.exit(1);
});

process.on('beforeExit', (code) => {
    log.debug(`beforeExit code: ${code}`);
});

process.on('exit', (code) => {
    // just to be sure
    try { fs.unlinkSync(WALLET_CFGFILE); } catch (e) { }
    log.debug(`exit with code: ${code}`);
});

process.on('warning', (warning) => {
    log.warn(`${warning.code}, ${warning.name}`);
});