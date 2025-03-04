const path = require('path');
const fs = require('fs');
const os = require('os');
const childProcess = require('child_process');
const log = require('electron-log');
const Store = require('electron-store');
const WalletShellSession = require('./ws_session');
const WalletShellApi = require('./ws_api');
const uiupdater = require('./wsui_updater');
const wsutil = require('./ws_utils');
const config = require('./ws_config');
const { remote } = require('electron');
const settings = new Store({name: 'Settings'});
const wsession = new WalletShellSession();

const SERVICE_LOG_DEBUG = wsession.get('debug');
const SERVICE_LOG_LEVEL_DEFAULT = 0;
const SERVICE_LOG_LEVEL_DEBUG = 4;
const SERVICE_LOG_LEVEL = (SERVICE_LOG_DEBUG ? SERVICE_LOG_LEVEL_DEBUG : SERVICE_LOG_LEVEL_DEFAULT);

const ERROR_WALLET_EXEC = `Failed to start ${config.walletServiceBinaryFilename}. Set the path to ${config.walletServiceBinaryFilename} properly in the settings tab.`;
const ERROR_WALLET_PASSWORD = 'Failed to load your wallet, please check your password';
const ERROR_WALLET_IMPORT = 'Import failed, please check that you have entered all information correctly';
const ERROR_WALLET_CREATE = 'Wallet can not be created, please check your input and try again';

const INFO_FUSION_DONE = 'Wallet optimization completed, your balance may appear incorrect for a while.';
const INFO_FUSION_SKIPPED = 'Wallet already optimized. No further optimization is needed.';
const ERROR_FUSION_FAILED = 'Unable to optimize your wallet, please try again in a few seconds';

var WalletShellManager = function(){
    if (!(this instanceof WalletShellManager)){
        return new WalletShellManager();
    }

    this.daemonHost = settings.get('daemon_host');
    this.daemonPort = settings.get('daemon_port');
    this.serviceProcess = null;
    this.nodeProcess = null;
    this.serviceBin = settings.get('service_bin');
    this.nodeBin = settings.get('node_bin');
    this.servicePassword = settings.get('service_password');
    this.serviceHost = settings.get('service_host');
    this.servicePort = settings.get('service_port');
    this.nodeArgsDefault = [];
    this.serviceArgsDefault = ['--rpc-user', 'dynex', '--rpc-password', 'dynex'];
    this.walletConfigDefault = {'rpc-user': 'dynex', 'rpc-password': 'dynex'};
    this.servicePid = null;
    this.serviceLastPid = null;
    this.nodePid = null;
    this.nodeLastPid = null;	
    this.serviceActiveArgs = [];
    this.serviceApi =  null;
    this.syncWorker = null;
    this.fusionTxHash = [];
};

WalletShellManager.prototype.init = function(){
    this._getSettings();
    if(this.serviceApi !== null) return;
    
    let cfg = {
        service_host: this.serviceHost,
        service_port: this.servicePort,
        service_password: this.servicePassword
    };
    this.serviceApi = new WalletShellApi(cfg);
};

WalletShellManager.prototype._getSettings = function(){
    this.daemonHost = settings.get('daemon_host') || "127.0.0.1";
    this.daemonPort = settings.get('daemon_port') || "18333";
    this.serviceBin = settings.get('service_bin') || "DNX-service";
    this.nodeBin = settings.get('node_bin') || "DNX-node";
};

WalletShellManager.prototype._reinitSession = function(){
    wsession.reset();
    // remove wallet config
    let configFile = wsession.get('walletConfig');
    if(configFile) try{ fs.unlinkSync(configFile); }catch(e){}
    this.notifyUpdate({
        type: 'sectionChanged',
        data: 'reset-oy'
    });
};

WalletShellManager.prototype._serviceBinExists = function () {
    wsutil.isFileExist(this.serviceBin);
};

// check 
WalletShellManager.prototype.serviceStatus = function(){
    return  (undefined !== this.serviceProcess && null !== this.serviceProcess);
};
WalletShellManager.prototype.nodeStatus = function(){
    return  (undefined !== this.nodeProcess && null !== this.nodeProcess);
};

WalletShellManager.prototype.isRunning = function () {
    this.init();
    let proc = path.basename(this.serviceBin);
    let platform = process.platform;
    let cmd = '';
    switch (platform) {
        case 'win32' : cmd = `tasklist`; break;
        case 'darwin' : cmd = `ps -ax | grep ${proc}`; break;
        case 'linux' : cmd = `ps -A`; break;
        default: break;
    }
    if(cmd === '' || proc === '') return false;

    childProcess.exec(cmd, (err, stdout, stderr) => {
        if(err) log.debug(err.message);
        if(stderr) log.debug(stderr.toLocaleLowerCase());
        let found = stdout.toLowerCase().indexOf(proc.toLowerCase()) > -1;
        log.debug(`Process found: ${found}`);
        return found;
    });
};

WalletShellManager.prototype._writeIniConfig = function(cfg){
    let configFile = wsession.get('walletConfig');
    if(!configFile) return '';

    try{
        fs.writeFileSync(configFile, cfg);
        return configFile;
    }catch(err){
        log.error(err);
        return '';
    }
};

WalletShellManager.prototype._writeConfig = function(cfg){
    let configFile = wsession.get('walletConfig');
    if(!configFile) return '';

    cfg = cfg || {};
    if(!cfg) return '';

    let configData = '';
    Object.keys(cfg).map((k) => { configData += `${k}=${cfg[k]}${os.EOL}`;});
    try{
        fs.writeFileSync(configFile, configData);
        return configFile;
    }catch(err){
        log.error(err);
        return '';
    }
};

WalletShellManager.prototype.startNode = function(){
    this.init();
    if(null !== this.nodeLastPid){
        // try to kill last process, in case it was stalled
        log.debug(`Trying to clean up old/stalled process, target pid: ${this.serviceLastPid}`);
        try{
            process.kill(this.nodeLastPid, 'SIGKILL');
        }catch(e){}
    }

    let nodeArgs = this.nodeArgsDefault.concat([
        '--enable-cors', '*',		// Required so that Chromium Framework Security doesnt reject requests
		'--log-level', 0,			// Log Level = 0 (No Logging, to save on RAM usage)
		//'--no-console',			// No output to console, as its embedded
		'--restricted-rpc',			// RPC only needs to be READ VIEW
    ]);

	log.debug('[dnx-node] worker started');	
	let wsm = this;
	this.nodeProcess = childProcess.spawn(wsm.nodeBin, nodeArgs);	
	this.nodePid = this.nodeProcess.pid;
	log.debug('[dnx-node] pid: ' + this.nodePid);
};
WalletShellManager.prototype.stopNode = async function(){
    this.init();
    return new Promise(async (resolve) => {
		this.nodeLastPid = this.nodeProcess.pid;
		try {
			await terminateNodeProcess(this.nodeProcess, this.nodeProcess.pid);
			resolve(true);
		} catch (err) {
			log.debug(`[dnx-node] SIGTERM failed: ${err}`);
			resolve(false);
		}
    });
};
// Function to cleanly stop the DNX-node process
async function terminateNodeProcess(nodeProcess, nodePid) {
    return new Promise((resolve, reject) => {
        // Check if nodeProcess is defined and has a valid pid
        if (!nodeProcess || !nodePid) {
            log.error('[dnx-node] No active process found or already terminated.');
            resolve(true); // Resolve immediately if no active process is found
            return;
        }
        log.debug(`[dnx-node] Sending 'exit' command to process with pid: ${nodePid}`);
        let force2KILL;
        try {
            // Listen for the 'exit' event to confirm the process termination
            nodeProcess.on('exit', (code, signal) => {
                clearTimeout(force2KILL);
                log.debug(`[dnx-node] worker exited with code ${code}, signal ${signal}`);
                resolve(true); // Resolve once the process has exited
            });

            // Handle any errors from the process
            nodeProcess.on('error', (err) => {
                clearTimeout(force2KILL);
                log.error(`[dnx-node] Error during shutdown: ${err.message}`);
                resolve(false); // Resolve with failure if there's an error
            });
            if (nodeProcess.stdin.writable) {
                nodeProcess.stdin.write('exit\n'); // send 'exit' to this shit
                nodeProcess.stdin.end(); // cclose stdin 
            } else {
                log.error('[dnx-node] Process stdin is not writable.');
                reject(new Error('Process stdin is not writable.'));
            }
            force2KILL = setTimeout(() => {
                log.warn(`[dnx-node] Process with pid ${nodePid} did not terminate within 2 minutes.`);
                try {
                    process.kill(nodePid, 'SIGKILL'); // kill this thing lol
                    resolve(false); 
                } catch (err) {
                    log.error(`[dnx-node] Failed to forcefully terminate process: ${err.message}`); // just in case
                    resolve(false); 
                }
            }, 2 * 60 * 1000);
        } catch (err) {
            log.error(`[dnx-node] Failed to terminate process: ${err.message}`);
            resolve(false); // Resolve with failure if there's an error sending the command
        }
    });
}



WalletShellManager.prototype.startService = function(walletFile, password, onError, onSuccess, onDelay){
    this.init();

    if(null !== this.serviceLastPid){
        // try to kill last process, in case it was stalled
        log.debug(`Trying to clean up old/stalled process, target pid: ${this.serviceLastPid}`);
        try{
            process.kill(this.serviceLastPid, 'SIGKILL');
        }catch(e){}
    }

    if(this.syncWorker) this.stopSyncWorker();
    
    let serviceArgs = this.serviceArgsDefault.concat([
        '-w', walletFile,
        '-p', password,
		'--daemon-address', '127.0.0.1',
		'--daemon-port', '18333',
        '--log-level', 0,
        '--log-file', path.join(remote.app.getPath('temp'), 'ts.log'), // macOS failed without this
        '--address'
    ]);

    let wsm = this;

    childProcess.execFile(this.serviceBin, serviceArgs, (error, stdout, stderr) => {
		if(stderr) log.debug(stderr);

		if(error){
			log.debug(error.message);
			onError(`ERROR_WALLET_EXEC: ${error.message}`);
		}else{
			log.debug(stdout);
			if(stdout && stdout.length && stdout.indexOf(config.addressPrefix) !== -1){
				let trimmed = stdout.trim();
				let walletAddress = trimmed.substring(trimmed.indexOf(config.addressPrefix), trimmed.length);
				wsession.set('loadedWalletAddress', walletAddress);
				wsm._spawnService(walletFile, password, onError, onSuccess, onDelay);
			}else{
				// just stop here
				onError(ERROR_WALLET_PASSWORD);
			}
		}
	});
};

WalletShellManager.prototype._argsToIni = function(args) {
    let configData = "";
    if("object" !== typeof args || !args.length) return configData;
    args.forEach((k,v) => {
        let sep = ((v%2) === 0) ? os.EOL : "=";
        configData += `${sep}${k.toString().replace('--','')}`;
    });
    return configData.trim();
};

WalletShellManager.prototype._spawnService = function(walletFile, password, onError, onSuccess, onDelay){
    this.init();
    let file = path.basename(walletFile);
    let logFile = path.join(
        path.dirname(walletFile),
        `${file.split(' ').join('').split('.')[0]}.log`
    );

    let serviceArgs = this.serviceArgsDefault.concat([
        '--container-file', walletFile,
        '--container-password', password,	
		'--daemon-address', '127.0.0.1',
		'--daemon-port', '18333',		
        '--log-level', 0,
        '--log-file', logFile
    ]);

    let configFile = wsession.get('walletConfig', null);
    if(configFile){
        let configFormat = settings.get('configFormat','ini');
        if(configFormat === 'json'){
            childProcess.execFile(this.serviceBin, serviceArgs.concat(['--save-config', configFile]), (error) => {
                if(error) configFile = null;
            });
        }else{
            let newConfig = this._argsToIni(serviceArgs);
            configFile = this._writeIniConfig(newConfig);
        }
    }else{
        log.warn('Failed to create config file, fallback to cmd args ');
    }

    let wsm = this;
    try{
        this.serviceProcess = childProcess.spawn(wsm.serviceBin, serviceArgs);
        this.servicePid = this.serviceProcess.pid;
		log.debug('[dnx-service] worker started');
		log.debug('[dnx-service] pid: ' + this.serviceProcess.pid);
    }catch(e){
        if(onError) onError(ERROR_WALLET_EXEC);
        log.error(`${config.walletServiceBinaryFilename} is not running`);
        return false;
    }
    
    this.serviceProcess.on('close', () => {
        this.terminateService(true);
        log.debug(`[dnx-service] closed`);
    });

    this.serviceProcess.on('error', (err) => {
        this.terminateService(true);
        wsm.syncWorker.stopSyncWorker();
        log.error(`${config.walletServiceBinaryFilename} error: ${err.message}`);
    });

    if(!this.serviceStatus()){
        if(onError) onError(ERROR_WALLET_EXEC);
        log.error(`${config.walletServiceBinaryFilename} is not running`);
        return false;
    }

    let TEST_OK = false;
    const MAX_CHECK = 10;
    function testConnection(retry){
		log.debug('[dnx-service] testing connection');
        wsm.serviceApi.getAddress().then((address) => {
            log.debug('[dnx-service] connection test - pass');
            if(!TEST_OK){
                wsm.serviceActiveArgs = serviceArgs;
                // update session
                wsession.set('loadedWalletAddress', address);
                wsession.set('serviceReady', true);
                wsession.set('connectedNode', `${settings.get('daemon_host')}:${settings.get('daemon_port')}`);
                // start the worker here?
                wsm.startSyncWorker();
                wsm.notifyUpdate({
                    type: 'addressUpdated',
                    data: address
                });

                onSuccess(walletFile);
                TEST_OK = true;
            }
            return true;
        }).catch((err) => {
			log.debug(err);
            log.debug('Connection failed or timedout');
            if(retry === 7 && onDelay) onDelay(`Still no response from ${config.walletServiceBinaryFilename}.<br />Is your wallet password valid?`);
            if(retry >= MAX_CHECK && !TEST_OK){
                if(wsm.serviceStatus()){
                    wsm.terminateService();
                }
                wsm.serviceActiveArgs = [];
                onError(err);
                return false;
            }else{
                setTimeout(function(){
                    let nextTry = retry+1;
                    log.debug(`retrying testconn (${nextTry})`);
                    testConnection(nextTry);
                }, 1800);
            }
        });
    }

    setTimeout(function(){
        testConnection(0);
    }, 5000);
};

WalletShellManager.prototype.stopService = function(){
    this.init();
    let wsm = this;
    return new Promise(function (resolve){
        if(wsm.serviceStatus()){
            wsm.serviceLastPid = wsm.serviceProcess.pid;
            wsm.stopSyncWorker(true);
            wsm.serviceApi.save().then(() =>{
                try{
                    wsm.terminateService(true);
                    wsm._reinitSession();
                    resolve(true);
                }catch(err){
                    log.debug(`SIGTERM failed: ${err.message}`);
                    wsm.terminateService(true);
                    wsm._reinitSession();
                    resolve(false);
                }
            }).catch((err) => {
                log.debug(`Failed to save wallet: ${err.message}`);
                // try to wait for save to completed before force killing
                setTimeout(()=>{
                    wsm.terminateService(true); // force kill
                    wsm._reinitSession();
                    resolve(true);
                },10000);
            });
        } else {
            wsm._reinitSession();
            resolve(false);
        }
    });
};

WalletShellManager.prototype.terminateService = function(force) {
    if(!this.serviceStatus()) return;
    force = force || false;
    let signal = force ? 'SIGKILL' : 'SIGTERM';
    // ugly fix for Terminating the DNX-Service!
    this.serviceLastPid = this.servicePid;
    try{
        this.serviceProcess.kill(signal);
        if(this.servicePid) process.kill(this.servicePid, signal);
    }catch(e){
        if(!force && this.serviceProcess) {
            log.debug(`SIGKILLing ${config.walletServiceBinaryFilename}`);
            try{this.serviceProcess.kill('SIGKILL');}catch(err){}
            if(this.servicePid){
                try{process.kill(this.servicePid, 'SIGKILL');}catch(err){}
            }
        }
    }
    
    this.serviceProcess = null;
    this.servicePid = null;
};

WalletShellManager.prototype.startSyncWorker = function(){
    this.init();
    let wsm = this;
    if(this.syncWorker !== null){
        this.syncWorker = null;
        try{wsm.syncWorker.kill('SIGKILL');}catch(e){}
    }

    this.syncWorker = childProcess.fork(
        path.join(__dirname,'./ws_syncworker.js')
    );
    
    this.syncWorker.on('message', (msg) => {
        if(msg.type === 'serviceStatus' ){
            wsm.syncWorker.send({
                type: 'start',
                data: {}
            });
            wsession.set('serviceReady', true);
            wsession.set('syncStarted', true);
        }else{
            wsm.notifyUpdate(msg);
        }
    });

    this.syncWorker.on('close', function (){
        wsm.syncWorker = null;
        try{wsm.syncWorker.kill('SIGKILL');}catch(e){}
        log.debug(`[dnx-service] worker terminated.`);
    });

    this.syncWorker.on('exit', function (){
        wsm.syncWorker = null;
        log.debug(`[dnx-service] worker exited.`);
    });

    this.syncWorker.on('error', function(err){
        try{wsm.syncWorker.kill('SIGKILL');}catch(e){}
        wsm.syncWorker = null;
        log.debug(`[dnx-service] worker error: ${err.message}`);
    });

    let cfgData = {
        type: 'cfg',
        data: {
            service_host: this.serviceHost,
            service_port: this.servicePort,
            service_password: this.servicePassword
        },
        debug: SERVICE_LOG_DEBUG
    };
    this.syncWorker.send(cfgData);
};

WalletShellManager.prototype.stopSyncWorker = function(){
    if(null === this.syncWorker) return;

    try{
        this.syncWorker.send({type: 'stop', data: {}});
        this.syncWorker.kill('SIGTERM');
        this.syncWorker  = null;
    }catch(e){
        log.debug(`syncworker already stopped`);
    }
};

WalletShellManager.prototype.genIntegratedAddress = function(paymentId, address){
    let wsm = this;
    return new Promise((resolve, reject) => {
        address = address || wsession.get('loadedWalletAddress');
        let params = {address: address, paymentId: paymentId};
        wsm.serviceApi.createIntegratedAddress(params).then((result) =>{
            return resolve(result);
        }).catch((err)=>{
            return reject(err);
        });
    });
};

WalletShellManager.prototype.createWallet = function(walletFile, password){
    this.init();
    let wsm = this;
    return new Promise((resolve, reject) => {
        let serviceArgs = wsm.serviceArgsDefault.concat(
            [
                '-g', '--deterministic', '-w', walletFile, '-p', password,
				'--daemon-address', '127.0.0.1',
				'--daemon-port', '18333',				
                '--log-level', 0, 		
				'--log-file', path.join(remote.app.getPath('temp'), 'ts.log')
            ]
        );
        childProcess.execFile(
            wsm.serviceBin, serviceArgs, (error, stdout, stderr) => {
                if(stdout) log.debug(stdout);
                if(stderr) log.debug(stderr);
                if (error){
                    log.error(`Failed to create wallet: ${error.message}`);
                    return reject(new Error(ERROR_WALLET_CREATE));
                } else {
                    if(!wsutil.isRegularFileAndWritable(walletFile)){
                        log.error(`${walletFile} is invalid or unreadable`);
                        return reject(new Error(ERROR_WALLET_CREATE));
                    }
                    return resolve(walletFile);
                }
            }
        );
    });
};

WalletShellManager.prototype.importFromKeys = function(walletFile, password, viewKey, spendKey){
    this.init();
    let wsm = this;

    return new Promise((resolve, reject) => {
        let serviceArgs = wsm.serviceArgsDefault.concat([
            '-g', '-w', walletFile, '-p', password,
            '--view-key', viewKey, 
			'--spend-key', spendKey,
			'--daemon-address', '127.0.0.1',
			'--daemon-port', '18333',			
			'--log-level', 0, 
			'--log-file', path.join(remote.app.getPath('temp'), 'ts.log')
        ]);

        childProcess.execFile(
            wsm.serviceBin, serviceArgs, (error, stdout, stderr) => {
                if(stdout) log.debug(stdout);
                if(stderr) log.debug(stderr);
                if (error){
                    log.debug(`Failed to import key: ${error.message}`);
                    return reject(new Error(ERROR_WALLET_IMPORT));
                } else {
                    if(!wsutil.isRegularFileAndWritable(walletFile)){
                        return reject(new Error(ERROR_WALLET_IMPORT));
                    }
                    return resolve(walletFile);
                }
            }
        );

    });
};

WalletShellManager.prototype.importFromSeed = function(walletFile, password, mnemonicSeed){
    this.init();
    let wsm = this;
    return new Promise((resolve, reject) => {
        let serviceArgs = wsm.serviceArgsDefault.concat([
            '-g', '-w', walletFile, '-p', password,
            '--mnemonic-seed', mnemonicSeed,
            '--log-level', 0, 
			'--daemon-address', '127.0.0.1',
			'--daemon-port', '18333',			
			'--log-file', path.join(remote.app.getPath('temp'), 'ts.log')
        ]);

        childProcess.execFile(
            wsm.serviceBin, serviceArgs, (error, stdout, stderr) => {
                if(stdout) log.debug(stdout);
                if(stderr) log.debug(stderr);

                if (error){
                    log.debug(`Error importing seed: ${error.message}`);
                    return reject(new Error(ERROR_WALLET_IMPORT));
                } else {
                    if(!wsutil.isRegularFileAndWritable(walletFile)){
                        return reject(new Error(ERROR_WALLET_IMPORT));
                    }
                    return resolve(walletFile);
                }
            }
        );
    });
};

WalletShellManager.prototype.getSecretKeys = async function(address){
    let wsm = this;
    return new Promise((resolve, reject) => {
        wsm.serviceApi.getBackupKeys({address: address}).then((result) => {
            return resolve(result);
        }).catch((err) => {
            return reject(err);
        });
    });
};

WalletShellManager.prototype.sendTransaction = function(params) {
    let wsm = this;
    return new Promise((resolve, reject) => {
        wsm.serviceApi.sendTransaction(params).then((result) => {
            let currentLanguage = settings.get('language') || "en";
            if (currentLanguage == 'pirate') {
                // Play the pirate MP3 sound clip
                try {
                    let audio = new Audio('../../src/assets/audio/1.mp3');
                    audio.play().catch(err => console.error("Error playing audio: ", err));
                } catch (error) {
                    console.log("Audio playback failed, possibly no audio device available: ", error);
                }
            }
            return resolve(result);
        }).catch((err) => {
            return reject(err);
        });
    });
};

WalletShellManager.prototype._fusionGetMinThreshold = function(threshold, minThreshold, maxFusionReadyCount, counter){
    let wsm = this;
    return new Promise((resolve, reject) => {
        counter = counter || 0;
        threshold = threshold || (parseInt(wsession.get('walletUnlockedBalance'),10)*100)+1;
        threshold = parseInt(threshold,10);
        minThreshold = minThreshold || threshold;
        maxFusionReadyCount = maxFusionReadyCount || 0;
        
        let maxThreshCheckIter = 20;

        wsm.serviceApi.estimateFusion({threshold: threshold}).then((res)=>{
            // nothing to optimize
            if( counter === 0 && res.fusionReadyCount === 0) return resolve(0); 
            // stop at maxThreshCheckIter or when threshold too low
            if( counter > maxThreshCheckIter || threshold < 10) return resolve(minThreshold);
            // we got a possibly best minThreshold
            if(res.fusionReadyCount < maxFusionReadyCount){
                return resolve(minThreshold);
            }
            // continue to find next best minThreshold
            maxFusionReadyCount = res.fusionReadyCount;
            minThreshold = threshold;
            threshold /= 2;
            counter += 1;
            resolve(wsm._fusionGetMinThreshold(threshold, minThreshold, maxFusionReadyCount, counter).then((res)=>{
                return res;
            }));
        }).catch((err)=>{
            return reject(new Error(err));
        });
    });
};

WalletShellManager.prototype._fusionSendTx = function(threshold, counter){
    let wsm = this;
	const wtime = ms => new Promise(resolve => setTimeout(resolve, ms));
    return new Promise((resolve, reject) => {
        counter = counter || 0;
        let maxIter = 256;
        if(counter >= maxIter) return resolve(wsm.fusionTxHash); // stop at max iter

		wtime(1200).then(() => {
			// keep sending fusion tx till it hit IOOR or reaching max iter 
			log.debug(`send fusion tx, iteration: ${counter}`);
			wsm.serviceApi.sendFusionTransaction({threshold: threshold}).then((resp)=> {
				wsm.fusionTxHash.push(resp.transactionHash);
				counter +=1;
				return resolve(wsm._fusionSendTx(threshold, counter).then((resp)=>{
					return resp;
				}));
			}).catch((err)=>{
				return reject(new Error(err));
			});
        });
    });
};

WalletShellManager.prototype.optimizeWallet = function(){
    let wsm = this;
	log.debug('[fusion] running wallet fusion service');
    return new Promise( (resolve, reject) => {
        wsm.fusionTxHash = [];
        wsm._fusionGetMinThreshold().then((res)=>{
			log.debug('[fusion] utxo input threshold: ', 20);
			log.debug('[fusion] current utxo input count: ', (res+1));
            if(res <= 0 ){
                wsm.notifyUpdate({
                    type: 'fusionTxCompleted',
                    data: INFO_FUSION_SKIPPED,
					code: 0
                });
				log.debug('[fusion] under threshold: skipped');
                // log.debug(wsm.fusionTxHash);
                return resolve(INFO_FUSION_SKIPPED);
            }

            log.debug(`performing fusion tx, threshold: ${res}`);

            return resolve(
                wsm._fusionSendTx(res).then(() => {
                    wsm.notifyUpdate({
                        type: 'fusionTxCompleted',
                        data: INFO_FUSION_DONE,
						code: 1
                    });
                    log.debug('[fusion] wallet fusion done');
                    log.debug(wsm.fusionTxHash);
                    return INFO_FUSION_DONE;
                }).catch((err)=>{
                    let msg = err.message.toLowerCase();
                    let outMsg = ERROR_FUSION_FAILED;
                    switch(msg){
                        case 'index is out of range':
                            outMsg = wsm.fusionTxHash.length >=1 ? INFO_FUSION_DONE : INFO_FUSION_SKIPPED;
                            break;
                        default:
                            break;
                    }
                    log.debug(`fusionTx outMsg: ${outMsg}`);
                    log.debug(wsm.fusionTxHash);
                    wsm.notifyUpdate({
                        type: 'fusionTxCompleted',
                        data: outMsg,
						code: outMsg === INFO_FUSION_SKIPPED ? 0 : 1
                    });
                    return outMsg;
                })
            );
        }).catch((err)=>{
            log.debug('[fusion] error');
            console.log(err);
            return reject((err.message));
        });
    });
};

WalletShellManager.prototype.networkStateUpdate = function(state){
    if(!this.syncWorker) return;    
    log.debug('ServiceProcess PID: ' + this.servicePid);
    if(state === 0){
        // pause the syncworker, but leave service running
        this.syncWorker.send({
            type: 'pause',
            data: null
        });
    }else{
        this.init();
        // looks like DNX-service always stalled after disconnected, just kill & relaunch it
        let pid = this.serviceProcess.pid || null;
        this.terminateService();
        // remove config
        try { fs.unlinkSync(wsession.get('walletConfig')); } catch (e) { }
        // wait a bit
        setImmediate(() => {
            if(pid){
                try{process.kill(pid, 'SIGKILL');}catch(e){}
                // remove config
                try { fs.unlinkSync(wsession.get('walletConfig')); } catch (e) { }
            }
            setTimeout(()=>{
                log.debug(`respawning ${config.walletServiceBinaryFilename}`);
                this.serviceProcess = childProcess.spawn(this.serviceBin, this.serviceActiveArgs);
                // store new pid
                this.servicePid = this.serviceProcess.pid;
                this.syncWorker.send({
                    type: 'resume',
                    data: null
                });
            },15000);
        },2500);        
    }
};

WalletShellManager.prototype.notifyUpdate = function(msg){
    uiupdater.updateUiState(msg);
};

WalletShellManager.prototype.resetState = function(){
    return this._reinitSession();
};

WalletShellManager.prototype.loadMempool = function(walletAddr) {
	let wsm = this;
	let loadedWalletAddr = wsession.get('loadedWalletAddress');	
	let params = {address: wsession.get('loadedWalletAddress')};
	return wsm.serviceApi.getMempoolForAddress(params);
};

module.exports = WalletShellManager;