/* globals List */
const os = require('os');
const path = require('path');
const fs = require('fs');
const {clipboard, remote, ipcRenderer, shell} = require('electron');
const Store = require('electron-store');
const Mousetrap = require('./extras/mousetrap.min.js');
const autoComplete = require('./extras/auto-complete');
const wsutil = require('./ws_utils');
const WalletShellSession = require('./ws_session');
const WalletShellManager = require('./ws_manager');
const WalletShellApi = require('./ws_api');
const config = require('./ws_config');
const Chart = require('chart.js');
const log = require('electron-log');
const request = require('request-promise-native');
const { setTranslations, translateString, applyTranslations, applyAdaptiveTextSize } = require('./ws_translation');

const wsmanager = new WalletShellManager();
const wsession = new WalletShellSession();
const settings = new Store({ name: 'Settings' });
const abook = new Store({
	name: 'AddressBook',
	encryptionKey: config.addressBookObfuscationKey
});

const win = remote.getCurrentWindow();
const Menu = remote.Menu;

const WS_VERSION = settings.get('version', 'unknown');
const DEFAULT_WALLET_PATH = remote.app.getPath('documents');

let WALLET_OPEN_IN_PROGRESS = false;
let TXLIST_OBJ = null;
let COMPLETION_PUBNODES;
let COMPLETION_ADDRBOOK;
let isHandlingMempool = false; // Flag to prevent overlapping function calls

const adaptiveTextExemptions = ['form-help', 'welcome-intro-title', 'welcome-intro'];
let translationsCache = {}; // Cache to store the loaded translations for reuse

/*  dom elements vars; */
// body
let body;
// main section link
let sectionButtons;
// generics
let genericBrowseButton;
let genericFormMessage;
let genericEnterableInputs;
let genericEditableInputs;
let firstTab;
// about page
let aboutButtonBack;
// settings page
let settingsInputDaemonAddress;
let settingsInputDaemonPort;
let settingsInputServiceBin;
let settingsInputNodeBin;
let settingsInputWrappedAddr;
let settingsInputQNodeSubGrp;
let settingsInputLanguage;
let settingsInputMinToTray;
let settingsInputCloseToTray;
let settingsButtonSave;
let settingsButtonBack;
// overview page
let overviewWalletAddress;
let overviewWalletCopyButton;
let overviewWalletCloseButton;
let overviewPaymentIdGen;
let overviewIntegratedAddressGen;
// addressbook page
let addressBookInputName;
let addressBookInputWallet;
let addressBookInputPaymentId;
let addressBookInputUpdate;
let addressBookButtonSave;
let addressBookSelectOrder;
// open wallet page
let walletOpenInputPath;
let walletOpenInputPassword;
let walletOpenButtonOpen;
let walletOpenButtons;
// locked wallet page
let walletLockedInputPassword;
let walletLockedButtonOpen;
let walletLockedButtons;
// show/export keys page
let overviewShowKeyButton;
let showkeyButtonExportKey;
let showkeyInputViewKey;
let showkeyInputSpendKey;
let showkeyInputSeed;
// send page
let sendInputAddress;
let sendInputAmount;
let sendInputPaymentId;
let sendInputFee;
let sendButtonSend;
let sendMaxAmount;
let sendOptimize;
// bridge page
let bridgeInputChainID;
let bridgeInputToAddr;
let bridgeInputAmount;
let bridgeButtonSend;	
// create wallet
let overviewButtonCreate;
let zoomQrCode;
let walletCreateInputPath;
let walletCreateInputPassword;
// import wallet keys
let importKeyButtonImport;
let importKeyInputPath;
let importKeyInputPassword;
let importKeyInputViewKey;
let importKeyInputSpendKey;
let importKeyInputScanHeight;
// import wallet seed
let importSeedButtonImport;
let importSeedInputPath;
let importSeedInputPassword;
let importSeedInputMnemonic;
let importSeedInputScanHeight;
// transaction
let txButtonRefresh;
let txButtonSortAmount;
let txButtonSortDate;
let txButtonSortStatus;
let txInputUpdated;
let txInputNotify;
let txButtonExport;
// misc
let sswitch;
let kswitch;
let iswitch;
let cswitch;
let lswitch;
// exchange
let chartConfig;
let chartInstance;

function populateElementVars(){
	// misc
	sswitch = document.getElementById('sswitch');
	kswitch = document.getElementById('kswitch');
	iswitch = document.getElementById('iswitch');
	cswitch = document.getElementById('cswitch');
	lswitch = document.getElementById('lswitch');
	firstTab = document.querySelector('.navbar-button');
	// generics
	genericBrowseButton = document.querySelectorAll('.path-input-button:not(.d-opened)');
	genericFormMessage = document.getElementsByClassName('form-ew');
	genericEnterableInputs = document.querySelectorAll('.section input:not(.noenter)');
	genericEditableInputs = document.querySelectorAll('textarea:not([readonly]), input:not([readonly]');

	// body
	body = document.getElementsByTagName('body');

	// main section link
	sectionButtons = document.querySelectorAll('[data-section]');

	// main section link
	aboutButtonBack = document.getElementById('button-about-back');

	// settings input & elements
	settingsInputDaemonAddress = document.getElementById('input-settings-daemon-address');
	settingsInputDaemonPort = document.getElementById('input-settings-daemon-port');
	settingsInputServiceBin = document.getElementById('input-settings-path');
	settingsInputNodeBin = document.getElementById('input-settings-path2');
	settingsInputWrappedAddr = document.getElementById('input-settings-eth-address');
	settingsInputQNodeSubGrp = document.getElementById('input-settings-qnode-subgrp');
	settingsInputLanguage = document.getElementById('input-settings-language');
	settingsInputMinToTray = document.getElementById('checkbox-tray-minimize');
	settingsInputCloseToTray = document.getElementById('checkbox-tray-close');
	settingsButtonSave = document.getElementById('button-settings-save');
	settingsButtonBack = document.getElementById('button-settings-back');

	// overview pages
	overviewWalletAddress = document.getElementById('wallet-address');
	overviewWalletCopyButton = document.getElementById('copy-wallet-address');
	overviewWalletCloseButton = document.getElementById('button-overview-closewallet');
	overviewPaymentIdGen = document.getElementById('payment-id-gen');
	overviewIntegratedAddressGen = document.getElementById('integrated-wallet-gen');

	// addressbook page
	addressBookInputName = document.getElementById('input-addressbook-name');
	addressBookInputWallet = document.getElementById('input-addressbook-wallet');
	addressBookInputPaymentId = document.getElementById('input-addressbook-paymentid');
	addressBookInputUpdate = document.getElementById('input-addressbook-update');
	addressBookButtonSave = document.getElementById('button-addressbook-save');
	addressBookSelectOrder = document.getElementById('button-addressbook-order');

	// open wallet page
	walletOpenInputPath = document.getElementById('input-load-path');
	walletOpenInputPassword = document.getElementById('input-load-password');
	walletOpenButtonOpen = document.getElementById('button-load-load');
	walletOpenButtons = document.getElementById('walletOpenButtons');
	
	// wallet locked page
	walletLockedInputPassword = document.getElementById('input-unlock-password');
	walletLockedButtonOpen = document.getElementById('button-unlock-load');
	walletLockedButtons = document.getElementById('walletUnlockButtons');	
	
	// show/export keys page
	overviewShowKeyButton = document.getElementById('button-show-reveal');
	showkeyButtonExportKey = document.getElementById('button-show-export');
	showkeyInputViewKey = document.getElementById('key-show-view');
	showkeyInputSpendKey = document.getElementById('key-show-spend');
	showkeyInputSeed = document.getElementById('seed-show');

	// send page
	sendInputAddress = document.getElementById('input-send-address');
	sendInputAmount = document.getElementById('input-send-amount');
	sendInputPaymentId = document.getElementById('input-send-payid');
	sendInputFee = document.getElementById('input-send-fee');
	sendButtonSend = document.getElementById('button-send-send');
	// maxSendFormHelp = document.getElementById('sendFormHelp');
	sendMaxAmount = document.getElementById('sendMaxAmount');
	sendOptimize = document.getElementById('button-send-optimize');
	// create wallet
	overviewButtonCreate = document.getElementById('button-create-create');
	zoomQrCode = document.getElementById('zoom-qr-code');
	walletCreateInputPath = document.getElementById('input-create-path');
	walletCreateInputPassword = document.getElementById('input-create-password');
	// import wallet keys
	importKeyButtonImport = document.getElementById('button-import-import');
	importKeyInputPath = document.getElementById('input-import-path');
	importKeyInputPassword = document.getElementById('input-import-password');
	importKeyInputViewKey = document.getElementById('key-import-view');
	importKeyInputSpendKey = document.getElementById('key-import-spend');
	importKeyInputScanHeight = document.getElementById('key-import-height');
	// import wallet seed
	importSeedButtonImport = document.getElementById('button-import-seed-import');
	importSeedInputPath = document.getElementById('input-import-seed-path');
	importSeedInputPassword = document.getElementById('input-import-seed-password');
	importSeedInputMnemonic = document.getElementById('key-import-seed');
	importSeedInputScanHeight = document.getElementById('key-import-seed-height');
	// tx page
	// transaction
	txButtonRefresh = document.getElementById('button-transactions-refresh');
	txButtonSortAmount = document.getElementById('txSortAmount');
	txButtonSortDate = document.getElementById('txSortTime');
	txButtonSortStatus = document.getElementById('txSortStatus');
	txInputUpdated = document.getElementById('transaction-updated');
	txInputNotify = document.getElementById('transaction-notify');
	txButtonExport = document.getElementById('transaction-export');
	// bridge page
	bridgeInputChainID = document.getElementById('input-send-bridge-chain');
	bridgeInputToAddr = document.getElementById('input-send-bridge-to');
	bridgeInputAmount = document.getElementById('input-send-bridge-amount');
	bridgeButtonSend = document.getElementById('button-send-bridge');	
}

// crude/junk template
let jtfr = {
   tFind:  [
		"WalletShell",
		"https://github.com/dynexcoin",
		"Dynex",
		"DNX",
		"DNX-service",
		"DNX-node"
	],
	tReplace: [
		config.appName,
		config.appGitRepo,
		config.assetName,
		config.assetTicker,
		config.walletServiceBinaryFilename,
		config.walletNodeBinaryFilename
	]
};

let junkTemplate = (text) => {
	return jtfr.tFind.reduce((acc, item, i) => {
		const regex = new RegExp(item, "g");
		return acc.replace(regex, jtfr.tReplace[i]);
  }, text);
};

function initSectionTemplates(){
	const importLinks = document.querySelectorAll('link[rel="import"]');
	for (var i = 0; i < importLinks.length; i++){
		let template = importLinks[i].import.getElementsByTagName("template")[0];
		let templateString = junkTemplate(template.innerHTML);
		let templateNode = document.createRange().createContextualFragment(templateString);
		let clone = document.adoptNode(templateNode);
		document.getElementById('main-div').appendChild(clone);
	}
	// once all elements in place, safe to populate dom vars
	populateElementVars();
}

function genPaymentId(ret){
	ret = ret || false;
	
	let payId = require('crypto').randomBytes(32).toString('hex');
	if(ret) return payId;
	
	let dialogTpl = `<div class="transaction-panel">
	<h4>${translateString("paymentid_generate")}:</h4>
	<textarea data-cplabel="${translateString("paymentid_paymentid")}" title="${translateString("paymentid_click_tocopy")}" class="ctcl default-textarea" rows="1" readonly="readonly">${payId}</textarea>
	<div class="div-panel-buttons">
		<button  data-target="#ab-dialog" type="button" class="button-gray dialog-close-default">${translateString("paymentid_close_button")}</button>
	</div>
	`;
	let dialog = document.getElementById('ab-dialog');
	if(dialog.hasAttribute('open')) dialog.close();
	dialog.innerHTML = dialogTpl;
	dialog.showModal();
}

function showIntegratedAddressForm(){
	let dialog = document.getElementById('ab-dialog');
	let ownAddress = wsession.get('loadedWalletAddress');
	if(dialog.hasAttribute('open')) dialog.close();

	let iaform = `<div class="transaction-panel">
	<h4>Generate Integrated Address:</h4>
	<div class="input-wrap">
	<label>Wallet Address</label>
	<textarea id="genInputAddress" class="default-textarea" placeholder="Required, put any valid ${config.assetTicker} address..">${ownAddress}</textarea>
	</div>
	<div class="input-wrap">
	<label>Payment Id (<a id="makePaymentId" class="wallet-tool inline-tool" title="generate random payment id...">generate</a>)</label>
	<input id="genInputPaymentId" type="text" required="required" class="text-block" placeholder="Required, enter a valid payment ID, or click generate to get random ID" />
	</div>
	<div class="input-wrap">
	<textarea data-cplabel="Integrated address" placeholder="Fill the form &amp; click generate, integrated address will appear here..." rows="3" id="genOutputIntegratedAddress" class="default-textarea ctcl" readonly="readonly"></textarea>
	</div>
	<div class="input-wrap">
		<span class="form-ew form-msg text-spaced-error hidden" id="text-gia-error"></span>
	</div>
	<div class="div-panel-buttons">
		<button id="doGenIntegratedAddr" type="button" class="button-green dialog-close-default">Generate</button>
		<button  data-target="#ab-dialog" type="button" class="button-gray dialog-close-default">Close</button>
	</div>
	`;
	dialog.innerHTML = iaform;
	dialog.showModal();
}

function lockWallet(unlock = false) {
	if (unlock) {
		// Get all elements with the class 'navbar-button'
		const navbarButtons = document.querySelectorAll('.navbar-button');
		// Loop through each element and toggle its display property
		navbarButtons.forEach(button => {
			const currentDisplay = window.getComputedStyle(button).display;
			button.style.display = 'block';
		});			
		changeSection('section-overview');
		sswitch.classList.remove('hidden');
		kswitch.classList.remove('hidden');
		iswitch.classList.remove('hidden');
	} else {
		// Get all elements with the class 'navbar-button'
		const navbarButtons = document.querySelectorAll('.navbar-button');
		// Loop through each element and toggle its display property
		navbarButtons.forEach(button => {
			const currentDisplay = window.getComputedStyle(button).display;
			button.style.display = 'none';
		});	
		sswitch.classList.add('hidden');
		kswitch.classList.add('hidden');
		iswitch.classList.add('hidden');		
		changeSection('section-lockscreen');
	}
}

function showKeyBindings(){
	let dialog = document.getElementById('ab-dialog');
	if(dialog.hasAttribute('open')) dialog.close();
	let keybindingTpl = `<div id="section-shortcuts">
		<div class="transaction-panel">
			<div class="div-title clearfix">
				<img src="../assets/shortcuts/title.png" />
				<h2 class="title mt-1">${translateString("keybindings_title")}</h2>
				<div class="subtitle">${translateString("keybindings_subtitle")}</div>
			</div>
			<table class="custom-table kb-table">
				<tbody>
					<tr class="odd">
						<th scope="col"><kbd>Ctrl</kbd>+<kbd>Home</kbd></th>
						<td class="fc"><img src="../assets/general/arrow-left-white.png" /></td>
						<td>${translateString("keybinding_overview")}</td>
					</tr>
					<tr class="transparent">
						<td colspan="2"></td>
					</tr>
					<tr class="even">
						<th scope="col"><kbd>Ctrl</kbd>+<kbd>Tab</kbd></th>
						<td><img src="../assets/general/arrow-left-white.png" /></td>
						<td>${translateString("keybinding_next_screen")}</td>
					</tr>
					<tr class="transparent">
						<td colspan="2"></td>
					</tr>
					<tr class="odd">
						<th scope="col"><kbd>Ctrl</kbd>+<kbd>n</kbd></th>
						<td><img src="../assets/general/arrow-left-white.png" /></td>
						<td>${translateString("keybinding_new_wallet")}</td>
					</tr>
					<tr class="transparent">
						<td colspan="2"></td>
					</tr>
					<tr class="even">
						<th scope="col"><kbd>Ctrl</kbd>+<kbd>o</kbd></th>
						<td><img src="../assets/general/arrow-left-white.png" /></td>
						<td>${translateString("keybinding_open_wallet")}</td>
					</tr>
					<tr class="transparent">
						<td colspan="2"></td>
					</tr>
					<tr class="odd">
						<th scope="col"><kbd>Ctrl</kbd>+<kbd>i</kbd></th>
						<td><img src="../assets/general/arrow-left-white.png" /></td>
						<td>${translateString("keybinding_import_private_keys")}</td>
					</tr>
					<tr class="transparent">
						<td colspan="2"></td>
					</tr>
					<tr class="even">
						<th scope="col"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>i</kbd></th>
						<td><img src="../assets/general/arrow-left-white.png" /></td>
						<td>${translateString("keybinding_import_mnemonic_seed")}</td>
					</tr>
					<tr class="transparent">
						<td colspan="2"></td>
					</tr>
					<tr class="odd">
						<th scope="col"><kbd>Ctrl</kbd>+<kbd>e</kbd></th>
						<td><img src="../assets/general/arrow-left-white.png" /></td>
						<td>${translateString("keybinding_export_keys")}</td>
					</tr>
					<tr class="transparent">
						<td colspan="2"></td>
					</tr>
					<tr class="even">
						<th scope="col"><kbd>Ctrl</kbd>+<kbd>t</kbd></th>
						<td><img src="../assets/general/arrow-left-white.png" /></td>
						<td>${translateString("keybinding_transactions")}</td>
					</tr>
					<tr class="transparent">
						<td colspan="2"></td>
					</tr>
					<tr class="odd">
						<th scope="col"><kbd>Ctrl</kbd>+<kbd>s</kbd></th>
						<td><img src="../assets/general/arrow-left-white.png" /></td>
						<td>${translateString("keybinding_send_transfer")}</td>
					</tr>
					<tr class="transparent">
						<td colspan="2"></td>
					</tr>
					<tr class="even">
						<th scope="col"><kbd>Ctrl</kbd>+<kbd>x</kbd></th>
						<td><img src="../assets/general/arrow-left-white.png" /></td>
						<td>${translateString("keybinding_close_wallet")}</td>
					</tr>
					<tr class="transparent">
						<td colspan="2"></td>
					</tr>
					<tr class="odd">
						<th scope="col"><kbd>Ctrl</kbd>+<kbd>/</kbd></th>
						<td><img src="../assets/general/arrow-left-white.png" /></td>
						<td>${translateString("keybinding_shortcut_info")}</td>
					</tr>
					<tr class="transparent">
						<td colspan="2"></td>
					</tr>
					<tr class="even">
						<th scope="col"><kbd>Esc</kbd></th>
						<td><img src="../assets/general/arrow-left-white.png" /></td>
						<td>${translateString("keybinding_close_dialog")}</td>
					</tr> 
				</tbody>
			</table>
			<div class="div-panel-buttons">
				<button data-target="#ab-dialog" type="button" class="button-blue dialog-close-default">${translateString("keybinding_close_button")}</button>
			</div>
		</div>
	</div>`;	
	dialog.innerHTML = keybindingTpl;
	dialog.showModal();
}

function switchTab(){
	if(WALLET_OPEN_IN_PROGRESS){
		wsutil.showToast(translateString("system_opening"));
		return;
	}
	let isServiceReady = wsession.get('serviceReady') || false;
	let activeTab = document.querySelector('.btn-active');
	let nextTab = activeTab.nextElementSibling || firstTab;
	let nextSection = nextTab.dataset.section.trim();
	let skippedSections = [];
	if(!isServiceReady){
		skippedSections = ['section-send', 'section-transactions'];
		if(nextSection === 'section-overview') nextSection = 'section-welcome';
	} else if (wsession.get('fusionProgress')) {
        skippedSections = ['section-send'];
    }

	while(skippedSections.indexOf(nextSection) >=0){
		nextTab = nextTab.nextElementSibling;
		nextSection = nextTab.dataset.section.trim();
	}
	changeSection(nextSection);
}

function setCssWalletOpened() {
	body[0].classList.add('wallet-opened');
}

function setCssWalletClosed() {
	body[0].classList.remove('wallet-opened');
}
function formatNumber(number, decimals = 2) {
    number = number.toFixed(decimals) + '';
    x = number.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) { x1 = x1.replace(rgx, '$1' + ',' + '$2'); }
    return x1 + x2;
}
function formatHashrate(number) {
    // Define suffixes in order of magnitude
    const suffixes = ["H/s", "KH/s", "MH/s", "TH/s", "PH/s"];
    let tier = 0;

    // Keep dividing the number by 1000 to find the right tier
    while (number >= 1000 && tier < suffixes.length - 1) {
        number /= 1000;
        tier++;
    }
    // Format the number to 2 decimal places
    const formattedNumber = number.toFixed(2);
    // Return the number with the appropriate suffix
    return `${formattedNumber} ${suffixes[tier]}`;
}

function setIconSelected(btnActive) {
	// remove the selected icon from all the items
	let allButtons = document.querySelectorAll('.navbar button');
	for(var i=0; i < allButtons.length;i++){
		let img = allButtons[i].querySelector('img');
		let normal = img.getAttribute('data-normal');
		img.setAttribute('src', normal);
	}
	// add the selected icon to the current item
	if (btnActive) {
		let img = btnActive.querySelector('img');
		let selected = img.getAttribute('data-selected');
		img.setAttribute('src', selected);
	}
}
function formatDateTime(isoString) {
	const date = new Date(isoString);
	// Format the date as YYYY-MM-DD
	const formattedDate = date.toISOString().split('T')[0];
	// Format the time as HH:mm:ss
	const formattedTime = date.toTimeString().split(' ')[0];
	return `${formattedDate} ${formattedTime}`;
}
function formatWatts(watts) {
	if (typeof watts !== 'number' || watts < 0) {
		throw new Error('Input must be a non-negative number.');
	}
	// Convert the input from milliwatts to watts
	const actualWatts = watts / 1000;
	if (actualWatts < 1) {
		// If less than 1 watt, show watts directly (under 1 kW)
		return `${actualWatts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} watts`;
	} else {
		// Convert to kilowatts (divide by 1,000), round to 2 decimals, and format
		const kilowatts = (actualWatts / 1000).toFixed(2);
		return `${kilowatts} kW`;
	}
}
function lookupBridge() {
	request({
		uri: 'https://bridge.dynexcoin.org/api/bridge/stats',
		method: 'GET',
		json: true,
		timeout: 3000
	}).then((res) => {
		if (!res) return resolve(true);
		if (!res.error) {
			var a = document.getElementById('bridge-total-volume');
			a.innerHTML = formatNumber(parseFloat(res.total_volume / 1000000000), 2) + " DNX";
			var b = document.getElementById('bridge-24hr-volume');
			b.innerHTML = formatNumber(parseFloat(res.volume_24_h / 1000000000), 2) + " DNX";
			var c = document.getElementById('bridge-total-transactions');
			c.innerHTML = res.transactions;		
			var d = document.getElementById('bridge-fee-amount');
			d.innerHTML = (res.dnx_bridge_fee / 1000000000);					
		}
	}).catch((err) => {
		log.debug("[dnx-bridge]", "error fetching from api");
	});		
}
function lookupDHIP() {
	request({
		uri: 'https://api.dhip.dynexcoin.org/api/v1/dhip/stats',
		method: 'GET',
		json: true,
		timeout: 3000
	}).then((res) => {
		if (!res) return resolve(true);
		if (!res.error) {
			log.debug("[dnx-dhip] APY:", res.apy.toFixed(2) + " %");
			var a = document.getElementById('dhip-rebate-percent');
			a.innerHTML = res.apy.toFixed(2) + " %";
			// Wrapped DNX - DHIP
			var b = document.getElementById('tvl-0xdnx');
			b.innerHTML = formatNumber((res.tvl / 1000000000), 2) + " 0xDNX";
			var c = document.getElementById('claimed-0xdnx');
			c.innerHTML = formatNumber((res.month_summary[(res.month_summary.length - 1)].amount / 1000000000), 2) + " 0xDNX";
			// Native DNX - DHIP
			var d = document.getElementById('tvl-dnx');
			d.innerHTML = "0 DNX";
			var e = document.getElementById('claimed-dnx');			
			e.innerHTML = "0 DNX";
		}
	}).catch((err) => {
		log.debug("[dnx-dhip]", "error fetching from api");
	});	
}
function lookupHelp() {
	request({
		uri: 'https://y3ti.uk/help.json',
		method: 'GET',
		json: true,
		timeout: 3000
	}).then((res) => {
		if (!res) return resolve(true);
		if (!res.error) {
			log.debug("[dnx-help] retrieved help topics");
			let currentLanguage = settings.get('language') || "en";
			let langPack = res[currentLanguage];		
			
			let html = '';  let langDataCNT = 0;
			langPack.forEach((item) => {
				langDataCNT++; isActive = ""; isBlock = "";
				if (langDataCNT == 1) { isActive = "active"; isBlock = "display: block"; }
				html += `
					<div class="content-help-row">
						<button class="button-help toggleButton ${isActive}">${item.q}</button>
						<div class="content-help" style="${isBlock}">
						  <p>${item.a}</p>
						</div>	
					</div>
				`;
			});			
			var a = document.getElementById('content-help-frame');
			a.innerHTML = html;
			initHelp();
		}
	}).catch((err) => {
		log.debug("[dnx-dhip]", "error fetching from api");
	});	
}
/**
 * Fetches the balance of an ERC-20 token for a given wallet address.
 * @param {string} walletAddress - The wallet address to check the balance for.
 * @param {string} tokenAddress - The contract address of the ERC-20 token.
 * @returns {Promise<string>} - The balance of the ERC-20 token for the wallet.
 */
async function lookupWrappedDNX(walletAddress, tokenAddress) {
  const rpcUrl = "https://rpc.ankr.com/eth"; // Ankr Ethereum RPC URL
  
  try {
    // Validate wallet address format (should start with '0x' and be 42 characters long)
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new Error("Invalid wallet address format");
    }
    // Fetch the token decimals by calling the `decimals` function of the ERC-20 contract
    const decimals = await getTokenDecimals(rpcUrl, tokenAddress);
    // ERC-20 balanceOf(address) function selector
    const balanceOfMethodId = "0x70a08231";
    // Normalize the wallet address (remove 0x prefix)
    const normalizedWalletAddress = walletAddress.toLowerCase().replace(/^0x/, '');
    // Pad the wallet address to 32 bytes (64 characters)
    const paddedWalletAddress = normalizedWalletAddress.padStart(64, '0');
    // Construct the data payload for the RPC call (balanceOf + wallet address)
    const data = balanceOfMethodId + paddedWalletAddress;

    // JSON-RPC request payload
    const payload = {
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          to: tokenAddress, // Token contract address
          data: data,       // Data payload (balanceOf + wallet address)
        },
        "latest" // Use the latest block
      ],
      id: 1
    };

    // Send the JSON-RPC request to the Ethereum node
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    // Check for any errors in the response
    if (result.error) {
      throw new Error(result.error.message);
    }

    // The result will be a hex-encoded number
    const balanceHex = result.result;

    // Convert the hex balance to a string (raw balance in the smallest unit)
    const balance = parseInt(balanceHex, 16).toString();

    // Convert to human-readable format by dividing by token decimals using string manipulation
    const humanReadableBalance = divideStringByDecimals(balance, decimals);

    return humanReadableBalance;
  } catch (error) {
    console.log("Error fetching ERC-20 balance:", error);
    throw error;
  }
}

/**
 * Fetches the decimals of an ERC-20 token.
 * @param {string} rpcUrl - The Ankr Ethereum RPC URL.
 * @param {string} tokenAddress - The contract address of the ERC-20 token.
 * @returns {Promise<number>} - The decimals of the ERC-20 token.
 */
async function getTokenDecimals(rpcUrl, tokenAddress) {
  try {
    // ERC-20 decimals function selector
    const decimalsMethodId = "0x313ce567";

    // JSON-RPC request payload to call the `decimals` function
    const payload = {
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          to: tokenAddress, // Token contract address
          data: decimalsMethodId, // Data to call the `decimals` function
        },
        "latest" // Use the latest block
      ],
      id: 1
    };

    // Send the JSON-RPC request to the Ethereum node
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    // Check for any errors in the response
    if (result.error) {
      throw new Error(result.error.message);
    }

    // The result will be a hex-encoded number (the decimals)
    const decimalsHex = result.result;

    // Convert the hex decimals to a regular number
    const decimals = parseInt(decimalsHex, 16);
    return decimals;
  } catch (error) {
    console.log("Error fetching token decimals:", error);
  }
}

/**
 * Divide a string (representing a large number) by the token decimals to make it human-readable.
 * @param {string} balance - The raw balance in string format.
 * @param {number} decimals - The number of decimals for the token.
 * @returns {string} - The human-readable balance.
 */
function divideStringByDecimals(balance, decimals) {
	const balanceStr = balance.padStart(decimals + 1, '0'); // Pad with leading zeros to handle decimals
	const integerPart = balanceStr.slice(0, balanceStr.length - decimals);
	const decimalPart = balanceStr.slice(balanceStr.length - decimals);
	return `${integerPart}.${decimalPart.replace(/0+$/, '')}`; // Remove trailing zeros in decimal part
}
function lookupQnodes(nodeSubGrp) {
	if (nodeSubGrp != '' && nodeSubGrp != null) {
		request({
			uri: 'https://qn-api-prod.dynexcoin.org/qn-api/api/v1/public/subgroup/details/' + nodeSubGrp,
			method: 'GET',
			json: true,
			timeout: 3000
		}).then((res) => {
			if (!res) return resolve(true);
			if (!res.error) {
				log.debug("[dnx-qnode]", res.info.name);
				log.debug("[dnx-qnode]", "total nodes: " + res.subgroup_statistics.total_nodes_count);
				var nodeArr = res.nodes;
				var onlineNodes = 0;	var offlineNodes = 0;
				
				const qNodeTblBody = document.querySelector('#qnodes-list-table tbody');
				qNodeTblBody.innerHTML = '';				// Make sure to clear the table each time its loaded
				for (let nodeCNT = 0; nodeCNT < nodeArr.length; ++nodeCNT) {
					nodeElm = nodeArr[nodeCNT];
					if (nodeElm.status == 0) { onlineNodes++; var onlineStatus = `<span class='green'>${translateString("qnode_js_online")}</span>`; }
					if (nodeElm.status == 1) { offlineNodes++; var onlineStatus = `<span class='red'>${translateString("qnode_js_offline")}</span>`; }
									
					const newRow = document.createElement('tr');
					const cell1 = document.createElement('td'); const cell2 = document.createElement('td');
					const cell3 = document.createElement('td'); const cell4 = document.createElement('td');
					const cell5 = document.createElement('td'); const cell6 = document.createElement('td');
					const cell7 = document.createElement('td');

					cell1.textContent = nodeElm.name;
					cell2.textContent = nodeElm.card_statuses.length;
					cell3.textContent = nodeElm.uptime.days + "d " + nodeElm.uptime.hours + "h " + nodeElm.uptime.minutes + "m";
					cell4.textContent = nodeElm.load_average.load_1_min;
					cell5.textContent = formatWatts(nodeElm.power_consumption);
					cell6.textContent = nodeElm.country_code;
					cell7.innerHTML = onlineStatus;

					cell2.style.width = "10%"; cell3.style.width = "15%";
					cell4.style.width = "10%"; cell5.style.width = "10%";
					cell6.style.width = "10%"; cell7.style.width = "10%";

					newRow.appendChild(cell1); newRow.appendChild(cell2);
					newRow.appendChild(cell3); newRow.appendChild(cell4);
					newRow.appendChild(cell5); newRow.appendChild(cell6);
					newRow.appendChild(cell7);

					qNodeTblBody.appendChild(newRow);
				}
				log.debug("[dnx-qnode]", "online nodes: " + onlineNodes + " || offline nodes: " + offlineNodes);				
				var a = document.getElementById('qnodes-locked');
				a.innerHTML = "0 DNX Collateral";
				var b = document.getElementById('qnodes-online');
				b.innerHTML = onlineNodes + " " + translateString("qnode_js_online");
				var c = document.getElementById('qnodes-offline');
				c.innerHTML = offlineNodes + " " + translateString("qnode_js_offline");
				var d = document.getElementById('gpu-working');
				d.innerHTML = res.subgroup_statistics.gpu_stats.active + " " + translateString("qnode_js_working");
				var e = document.getElementById('gpu-mining');
				e.innerHTML = res.subgroup_statistics.gpu_stats.other + " " + translateString("qnode_js_mining");
				var f = document.getElementById('gpu-offline');
				f.innerHTML = res.subgroup_statistics.gpu_stats.inactive + " " + translateString("qnode_js_offline");
				var g = document.getElementById('stats-totalnodes');
				g.innerHTML = res.subgroup_statistics.total_nodes_count + " " + translateString("qnode_js_nodes");
				var h = document.getElementById('stats-power');
				h.innerHTML =  translateString("qnode_js_power") + ": " + formatWatts(res.subgroup_statistics.total_power_consumption);
				var i = document.getElementById('stats-lastupdate');
				i.innerHTML = translateString("qnode_js_lastupdate") + ": " + formatDateTime(res.info.updated_at);
				var j = document.getElementById('qnodeSubGrpName');
				j.innerHTML = res.info.name;
			}
		}).catch((err) => {
			log.debug("[dnx-qnode]", "error fetching from api");
		});
	}
}
function getDnxStatsPoW() {
	request({
		uri: 'https://api.market.dynexcoin.org/api/v2/network/stats/status',
		method: 'GET',
		json: true,
		timeout: 3000
	}).then((res) => {
		if (!res) return resolve(true);
		if (!res.error) {
			log.debug("[dnx-pow]", "load stats");
			a = document.getElementById('dnx-hashrate');
			a.innerHTML = formatHashrate(res.hashrate);
			b = document.getElementById('dnx-diff');
			b.innerHTML = formatNumber(res.difficulty, 0);
			c = document.getElementById('dnx-connected-miners');
			c.innerHTML = formatNumber(res.miners, 0);
			d = document.getElementById('dnx-connected-gpu');
			d.innerHTML = formatNumber(res.gpus, 0);
		}
	}).catch((err) => {
		log.debug("[dnx-pow]", "error fetching from api");
	});		
}
function getDnxStatsPoUW() {
	request({
		uri: 'https://api.market.dynexcoin.org/api/v2/network/jobs/month_chart',
		method: 'GET',
		json: true,
		timeout: 3000
	}).then((res) => {
		if (!res) return resolve(true);
		if (!res.error) {
			log.debug("[dnx-pouw]", "load stats");
			a = document.getElementById('dnx-pouw-jobs-month');
			a.innerHTML = formatNumber(res.summary.total_jobs_month, 0);
			b = document.getElementById('dnx-pouw-jobs-total');
			b.innerHTML = formatNumber(res.summary.total_jobs_year, 0);
		}
	}).catch((err) => {
		log.debug("[dnx-pouw]", "error fetching from api");
	});	
}
function getDnxPrice() {
	request({
		uri: 'https://api.market.dynexcoin.org/api/v2/network/currency/rate',
		method: 'GET',
		json: true,
		timeout: 3000
	}).then((res) => {
		if (!res) return resolve(true);
		if (!res.error) {
			log.debug("[dnx-price]", "$" + res.current_rate);
			settings.set('dnx_price_json', res.current_rate);
			settings.set('dnx_price_timestamp', new Date().getTime());						
			// Set the Variable - DNX/USDT Price
			a = document.getElementById('dnx-price-usd');
			if (res.rate_change_24_h_percent < 0) { rateChangeColor = "red"; } else { rateChangeColor = "green"; }
			a.innerHTML = "$ " + formatNumber(res.current_rate, 4) + "&nbsp;&nbsp;(<span class='" + rateChangeColor + "'>" + res.rate_change_24_h_percent.toFixed(2)	+ "%</span>)";
			// Set the Variable - DNX/BTC Price
			b = document.getElementById('dnx-price-btc');
			b.innerHTML = formatNumber(res.dnx_rate_btc, 12) + " BTC";
			// Set the Variable - Trading Volume (USD)
			c = document.getElementById('trading-volume-usd');
			c.innerHTML = "$ " + formatNumber(res.total_volume_dnx_usd, 2);
			// Set the Variable - Trading Volume (BTC)
			d = document.getElementById('trading-volume-btc');
			d.innerHTML = formatNumber(res.total_volume_dnx_btc, 12) + " BTC";
			// Set the Variable - Market Cap (USD)
			e = document.getElementById('market-cap-usd');
			e.innerHTML = "$ " + formatNumber(res.mcap_dnx_usd, 2);
			// Set the Variable - Market Cap (BTC)
			f = document.getElementById('market-cap-btc');
			f.innerHTML = formatNumber(res.mcap_dnx_btc, 12) + " BTC";
		}
	}).catch((err) => {
		log.debug("[dnx-price]", "error fetching from api");
	});
}

// section switcher
function changeSection(sectionId, isSettingRedir) {
	if(WALLET_OPEN_IN_PROGRESS){
		wsutil.showToast(translateString("system_opening"));
		return;
	}

	formMessageReset();
	isSettingRedir = isSettingRedir === true ? true : false;
	let targetSection = sectionId.trim();

	// when overview is loaded, show the sidebar nav
	if(targetSection === 'section-welcome'){
		sswitch.classList.remove('hidden');
		iswitch.classList.remove('hidden');
		let a = document.getElementById('welcome-bottom');
		a.innerHTML = "Version - " + config.walletVersion;
	}
	
	// when settings is loaded, show the warning
	if(targetSection === 'section-settings'){
		let walletOpened = wsession.get('serviceReady') || false;
		if (walletOpened) {
			settingsButtonBack.classList.add('hidden');
		} else {
			settingsButtonBack.classList.remove('hidden');
		}
	}	
	
	// when about is loaded, add the links and the content
	if(targetSection === 'section-about'){
		let a = document.getElementById('github-link');
		a.setAttribute('href', config.appGitRepo);

		let b = document.getElementById('app-version');
		b.innerHTML = config.electronVersion;

		let c = document.getElementById('wallet-version');
		c.innerHTML = config.walletVersion;

		let d = document.getElementById('service-version');
		d.innerHTML = config.walletServiceBinaryVersion;

		let e = document.getElementById('node-version');
		e.innerHTML = config.walletServiceNodeVersion;

		let walletOpened = wsession.get('serviceReady') || false;
		if (walletOpened) {
			aboutButtonBack.classList.add('hidden');
		} else {
			aboutButtonBack.classList.remove('hidden');
		}
	}	
	
	// when overview is loaded, show the sidebar nav and fetch DNX stats
	if(targetSection === 'section-overview'){
		setCssWalletOpened();
		getDnxPrice();
		getDnxStatsPoW();
		getDnxStatsPoUW();
		cswitch.classList.remove('hidden');
		lswitch.classList.remove('hidden');
	}
	// when address book is loaded, redraw the listing
	if(targetSection === 'section-addressbook'){
		listAddressBook(true);
	}
	// Bridge Functions
	if(targetSection === 'section-transactions'){	
		handleMempool();
	}
	// Bridge Functions
	if(targetSection === 'section-bridge'){
		lookupBridge();
		if (settings.get('wrapped_addr') != '' && settings.get('wrapped_addr') != undefined) {
			var myWrappedTokenAddr = settings.get('wrapped_addr');					// Users Stored 0xDNX WalletID
			var wrappedToken = '0x9928a8600d14ac22c0be1e8d58909834d7ceaf13';		// 0xDNX Token ID
			(async () => {
				try {
					const balance = await lookupWrappedDNX(myWrappedTokenAddr, wrappedToken);
					log.debug(`[dnx-0xdnx] Balance: ${balance} 0xDNX`);
					var a = document.getElementById('balanceWrapped');
					a.innerHTML = formatNumber(parseFloat(balance), 9);
				} catch (error) {
					log.debug("[dnx-0xdnx] Failed to fetch balance:", error);
				}
			})();			
		}
	}
	// DHIP Functions
	if(targetSection === 'section-dhip'){
		lookupDHIP();
	}
	// QNode Functions
	if(targetSection === 'section-qnode'){
		if (settings.get('qnode_subgrp') != '' && settings.get('qnode_subgrp') != undefined) {
			var myQnodeSubGrp = settings.get('qnode_subgrp');					// Users Stored qNode Subgroup
			lookupQnodes(myQnodeSubGrp);		
		}		
	}
	// Help Functions
	if(targetSection === 'section-help'){
		lookupHelp();
	}

	let untoast = false;
	if(targetSection === 'section-welcome'){
		targetSection = 'section-overview';
		untoast = true;
	}

	let isSynced = wsession.get('synchronized') || false;
	let isServiceReady = wsession.get('serviceReady') || false;
	let needServiceReady = ['section-transactions', 'section-send', 'section-overview'];
	let needServiceStopped = 'section-welcome';
	let needSynced = ['section-send'];
	if(needSynced.indexOf(targetSection) >= 0 && wsession.get('fusionProgress')){
		wsutil.showToast(translateString("system_walletfusion_inprogress"));
		return;
	}

	let finalTarget = targetSection;
	let toastMsg = '';
	
	if(needServiceReady.indexOf(targetSection) >=0 && !isServiceReady){
		// no access to wallet, send, tx when no wallet opened
		finalTarget = 'section-welcome';
		toastMsg = translateString("system_create");
	}else if(needServiceStopped.indexOf(targetSection) >=0 && isServiceReady){
		finalTarget = 'section-overview';
	}else if(needSynced.indexOf(targetSection) >=0 && !isSynced){
		// just return early
		wsutil.showToast(translateString("system_pleasewait"));
		return;
	}else{
		if(targetSection === 'section-overview-load'){
			// initNodeCompletion();
		}
		finalTarget = targetSection;
		toastMsg = '';
	}

	let section = document.getElementById(finalTarget);
	if(section.classList.contains('is-shown')){
		if(toastMsg.length && !isSettingRedir && !untoast) wsutil.showToast(toastMsg);
		return; // don't do anything if section unchanged
	}

	// navbar active section indicator, only for main section	
	const activeButton = document.querySelector(`.btn-active`);
	if(activeButton) activeButton.classList.remove('btn-active');
	setIconSelected();

	let finalButtonTarget = (finalTarget === 'section-welcome' ? 'section-overview' : finalTarget);
	let newActiveNavbarButton = document.querySelector(`.navbar button[data-section="${finalButtonTarget}"]`);
	if(newActiveNavbarButton){
		setIconSelected(newActiveNavbarButton);
		newActiveNavbarButton.classList.add('btn-active');
	}

	// toggle section
	const activeSection = document.querySelector('.is-shown');
	if(activeSection) activeSection.classList.remove('is-shown');
	section.classList.add('is-shown');
	section.dispatchEvent(new Event('click')); // make it focusable
	// show msg when needed
	if(toastMsg.length && !isSettingRedir && !untoast) wsutil.showToast(toastMsg);
	// notify section was changed
	let currentButton = document.querySelector(`button[data-section="${finalButtonTarget}"]`);
	if(currentButton){
		wsmanager.notifyUpdate({
			type: 'sectionChanged',
			data: currentButton.getAttribute('id')
		});
	}
}

// public nodes autocompletion
function initNodeCompletion(){
	if(!settings.has('pubnodes_data')) return;
	try{
		if(COMPLETION_PUBNODES) COMPLETION_PUBNODES.destroy();
	}catch(e){}

	let publicNodes = settings.has('pubnodes_custom') ? wsutil.arrShuffle(settings.get('pubnodes_data')) : [];
	let nodeChoices = settings.get('pubnodes_custom').concat(publicNodes);


	COMPLETION_PUBNODES = new autoComplete({
		selector: 'input[name="nodeAddress"]',
		minChars: 0,
		source: function(term, suggest){
			term = term.toLowerCase();
			var choices = nodeChoices;
			var matches = [];
			for (var i=0; i<choices.length; i++){
				let phost = choices[i].split(':')[0];
				if (~choices[i].toLowerCase().indexOf(term) && phost.length > term.length){
					matches.push(choices[i]);
				}
			}
			suggest(matches);
		},
		onSelect: function(e, term){
			settingsInputDaemonAddress.value = term.split(':')[0];
			settingsInputDaemonPort.value = term.split(':')[1];
			settingsInputDaemonAddress.dispatchEvent(new Event('blur'));
			return settingsButtonSave.dispatchEvent(new Event('focus'));
		}
	});
}

// initial settings value or updater
function initSettingVal(values){
	values = values || null;
	if(values){
		// save new settings
		settings.set('service_bin', values.service_bin);
		settings.set('node_bin', values.node_bin);
		settings.set('wrapped_addr', values.wrapped_addr);
		settings.set('qnode_subgrp', values.qnode_subgrp);
		settings.set('language', values.language);
		settings.set('daemon_host', values.daemon_host);
		settings.set('daemon_port', values.daemon_port);
		settings.set('tray_minimize', values.tray_minimize);
		settings.set('tray_close', values.tray_close);
	}
	settingsInputServiceBin.value = settings.get('service_bin');
	settingsInputNodeBin.value = settings.get('node_bin');
	settingsInputWrappedAddr.value = settings.get('wrapped_addr');
	settingsInputQNodeSubGrp.value = settings.get('qnode_subgrp');
	settingsInputLanguage.value = settings.get('language');
	settingsInputDaemonAddress.value = settings.get('daemon_host');
	settingsInputDaemonPort.value = settings.get('daemon_port');
	settingsInputMinToTray.checked = settings.get('tray_minimize');
	settingsInputCloseToTray.checked = settings.get('tray_close');

	// if custom node, save it
	let mynode = `${settings.get('daemon_host')}:${settings.get('daemon_port')}`;
	let pnodes = settings.get('pubnodes_data');
	if(!settings.has('pubnodes_custom')) settings.set('pubnodes_custom', []);
	let cnodes = settings.get('pubnodes_custom');
	if(pnodes.indexOf(mynode) === -1 && cnodes.indexOf(mynode) === -1){
		cnodes.push(mynode);
		settings.set('pubnodes_custom', cnodes);
	}
}
// address book completions
function initAddressCompletion(){
	var nodeAddress = [];

	Object.keys(abook.get()).forEach((key) => {
		let et = abook.get(key);
		nodeAddress.push(`${et.name}###${et.address}###${(et.paymentId ? et.paymentId : '')}`);
	});

	try{
		if(COMPLETION_ADDRBOOK) COMPLETION_ADDRBOOK.destroy();
	}catch(e){
		console.log(e);
	}

	COMPLETION_ADDRBOOK = new autoComplete({
		selector: 'input[id="input-send-address"]',
		minChars: 1,
		cache: false,
		source: function(term, suggest){
			term = term.toLowerCase();
			var choices = nodeAddress;
			var matches = [];
			for (var i=0; i<choices.length; i++)
				if (~choices[i].toLowerCase().indexOf(term)) matches.push(choices[i]);
			suggest(matches);
		},
		renderItem: function(item, search){
			search = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
			var re = new RegExp("(" + search.split(' ').join('|') + ")", "gi");
			var spl = item.split("###");
			var wname = spl[0];
			var waddr = spl[1];
			var wpayid = spl[2];
			return `<div class="autocomplete-suggestion" data-paymentid="${wpayid}" data-val="${waddr}">${wname.replace(re, "<b>$1</b>")}<br><span class="autocomplete-wallet-addr">${waddr.replace(re, "<b>$1</b>")}<br>${translateString("addressbook_js_paymentid")}: ${(wpayid ? wpayid.replace(re, "<b>$1</b>") : 'N/A')}</span></div>`;
		},
		onSelect: function(e, term, item){			   
			document.getElementById('input-send-payid').value = item.getAttribute('data-paymentid');
		}
	});
}

// generic form message reset
function formMessageReset(){
	if(!genericFormMessage.length) return;
	for(var i=0; i < genericFormMessage.length;i++){
		genericFormMessage[i].classList.add('hidden');
		wsutil.clearChild(genericFormMessage[i]);
	}
}
function formMessageSet(target, status, txt){
	// clear all msg
	formMessageReset();
	let the_target = `${target}-${status}`;
	let the_el = null;
	try{ 
		the_el = document.querySelector('.form-ew[id$="'+the_target+'"]');
	}catch(e){}
	
	if(the_el){
		the_el.classList.remove('hidden');
		wsutil.innerHTML(the_el, txt);
	}
}

// utility: blank tx filler
function setTxFiller(show){
	show = show || false;
	let fillerRow = document.getElementById('txfiller');
	let txRow = document.getElementById('transaction-lists');
	let mpRow = document.getElementById('mempool-lists');

	if(!show && fillerRow){
		fillerRow.parentNode.classList.add('hidden');
		txRow.classList.remove('hidden');
		mpRow.classList.remove('hidden');
	}else{
		let hasItemRow = document.querySelector('#transaction-list-table > tbody > tr.txlist-item');
		if(!hasItemRow)  {
			txRow.classList.add('hidden');
			mpRow.classList.add('hidden');
			fillerRow.parentNode.classList.remove('hidden');
		}
	}
}

// display initial page, settings page on first run, else overview page
function showInitialPage(){
	// other initiations here
	formMessageReset();
	initSettingVal(); // initial settings value
	// initNodeCompletion(); // initial public node completion list
	initAddressCompletion();

	if(!settings.has('firstRun') || settings.get('firstRun') !== 0){
		changeSection('section-settings');
		settings.set('firstRun', 0);
	}else{
		changeSection('section-welcome');
	}

	let versionInfo = document.getElementById('walletShellVersion');
	if(versionInfo) versionInfo.innerHTML = WS_VERSION;
	let wVersionInfo = document.getElementById('walletVersion');
	if(wVersionInfo) wVersionInfo.innerHTML = config.walletVersion;
	wsmanager.startNode();	
}

// settings page handlers
function handleSettings(){
    settingsButtonSave.addEventListener('click', function(){
        formMessageReset();
        let serviceBinValue = settingsInputServiceBin.value ? settingsInputServiceBin.value.trim() : '';
        let nodeBinValue = settingsInputNodeBin.value ? settingsInputNodeBin.value.trim() : '';
        let wrappedTokenValue = settingsInputWrappedAddr.value ? settingsInputWrappedAddr.value.trim() : '';
        let qnodeSubGrpValue = settingsInputQNodeSubGrp.value ? settingsInputQNodeSubGrp.value.trim() : '';
        let settingsLanguage = settingsInputLanguage.value ? settingsInputLanguage.value.trim() : '';
        let daemonHostValue = settingsInputDaemonAddress.value ? settingsInputDaemonAddress.value.trim() :'';
        let daemonPortValue = settingsInputDaemonPort.value ? parseInt(settingsInputDaemonPort.value.trim(),10) : '';

        // Bugfix to make sure that on 1st load that these options are "blank"
        if (wrappedTokenValue == "undefined" || wrappedTokenValue == undefined || wrappedTokenValue == null) { wrappedTokenValue = ""; }
        if (qnodeSubGrpValue == "undefined" || qnodeSubGrpValue == undefined || qnodeSubGrpValue == null) { qnodeSubGrpValue = ""; }

        if(!serviceBinValue.length){
            formMessageSet('settings','error', translateString("settings-js-unabletosave"));
            return false;
        }
        if(!nodeBinValue.length){
            formMessageSet('settings','error', translateString("settings-js-unabletosave"));
            return false;
        }        
        
        if(!wsutil.isRegularFileAndWritable(serviceBinValue)){
            let unableToFind = translateString("settings-js-unabletofind1") + " " + config.walletNodeBinaryFilename + " " + translateString("settings-js-unabletofind2");
            formMessageSet('settings','error', unableToFind);
            return false;
        }
        if(!wsutil.isRegularFileAndWritable(nodeBinValue)){
            let unableToFind = translateString("settings-js-unabletofind1") + " " + config.walletNodeBinaryFilename + " " + translateString("settings-js-unabletofind2");
            formMessageSet('settings','error', unableToFind);
            return false;
        }

		function checkBinaryFile(filePath) {
            filePath = filePath.replace(/^"(.*)"$/, '$1');
            return wsutil.isRegularFileAndWritable(filePath);
        }

        if(!checkBinaryFile(serviceBinValue)){
            let unableToFind = translateString("settings-js-unabletofind1") + " " + config.walletServiceBinaryFilename + " " + translateString("settings-js-unabletofind2");
            formMessageSet('settings', 'error', unableToFind);
            return false;
        }

        if(!checkBinaryFile(nodeBinValue)){
            let unableToFind = translateString("settings-js-unabletofind1") + " " + config.walletNodeBinaryFilename + " " + translateString("settings-js-unabletofind2");
            formMessageSet('settings', 'error', unableToFind);
            return false;
        }

        // validate hostname
        if(!daemonHostValue.length || !Number.isInteger(daemonPortValue)){
            formMessageSet('settings','error', translateString("settings-js-invalidnode"));
            return false;
        }

        let validHost = daemonHostValue === 'localhost' ? true : false;
        if(require('net').isIP(daemonHostValue)) validHost = true;
        if(!validHost){
            let domRe = new RegExp(/([a-z])([a-z0-9]+\.)*[a-z0-9]+\.[a-z.]+/i);
            if(domRe.test(daemonHostValue)) validHost = true;
        }
        if(!validHost){
            formMessageSet('settings','error', translateString("settings-js-invalidnode"));
            return false;
        }

        // validate port
        if(daemonPortValue <= 0 || daemonPortValue > 65534){
            formMessageSet('settings','error', translateString("settings-js-invalidnode"));
            return false;
        }

        let vals = {
            service_bin: serviceBinValue,
            node_bin: nodeBinValue,
            wrapped_addr: wrappedTokenValue,
            qnode_subgrp: qnodeSubGrpValue,
            language: settingsLanguage,
            daemon_host: daemonHostValue,
            daemon_port: daemonPortValue,
            tray_minimize: settingsInputMinToTray.checked,
            tray_close: settingsInputCloseToTray.checked
        };

        initSettingVal(vals);
        loadLanguage(settingsLanguage);
        remote.app.checkUpdateConfig(); // re-check config format
        formMessageReset();
        // initNodeCompletion();
        let goTo = wsession.get('loadedWalletAddress').length ? 'section-overview' : 'section-welcome';
        changeSection(goTo, true);
        wsutil.showToast(translateString("settings-js-updated"), 8000);
    });
}

function listenToAddressBookEvents() {
	let items = document.querySelectorAll('.div-addressbook-item');
	Array.from(items).forEach((item)=>{
		let select = item.querySelector('select');
		select.addEventListener('click', () => {
			formMessageReset();
			if (select.value == 'edit') {
				addressBookInputWallet.value = item.dataset.address;
				addressBookInputPaymentId.value = item.dataset.paymentid;
				addressBookInputName.value = item.dataset.name;
				addressBookInputUpdate.value = 1;
			} else if (select.value == 'delete') {
				addressBookInputWallet.value = '';
				addressBookInputPaymentId.value = '';
				addressBookInputName.value = '';
				addressBookInputUpdate.value = 0;

				setTimeout(function() {
					if (confirm(`${translateString("addressbook_js_areyousure1")} ${item.dataset.address} ${translateString("addressbook_js_areyousure2")}`)) {
						wsutil.showToast(translateString("addressbook_js_addr_deleted"),5000);
						abook.delete(item.dataset.key);
						listAddressBook(true);
					}
				}, 50);
			}
			// reset selectors
			let options = select.querySelectorAll('option');
			Array.from(options).forEach((option, idx)=>{
				option.selected = (idx == 0);
			});
		});
	});
}
function listAddressBook(force, sortBy){
	force = force || false;
	sortBy = sortBy || '';
	let currentLength = document.querySelectorAll('.div-addressbook-item').length;
	let abookLength = abook.size;

	if (currentLength == abookLength  && !force) return;

	let i = 1;
	let itemAddressBook = function(item) {
		let cont_start = (i === 1) || ((i - 1) % 4 == 0) ? '<div class="div-addressbook-items">' : '';
		let cont_end = (i % 4 == 0) || (i === abookLength) ? '</div>' : '';
		i++;
		return `${cont_start}
			<div class="item div-addressbook-item" data-key="${item.key}" data-name="${item.name}" data-address="${item.address}" data-paymentid="${item.paymentId}">
				<div class="user">${item.name}</div>
				<div class="address">${item.address}</div>
				<div class="actions">
					<select>
						<option>${translateString("addressbook_js_select")}</option>
						<option value="edit">${translateString("addressbook_js_edit")}</option>
						<option value="delete">${translateString("addressbook_js_delete")}</option>
					</select>
				</div>
			</div>
		${cont_end}`;
	};

	// get the array
	let addressBookEntries = [];
	Object.keys(abook.get()).forEach((key) => {
		let et = abook.get(key);
		et['key'] = key;
		addressBookEntries.push(et);
	});

	// sort the elements
	if (sortBy != '') {
		addressBookEntries.sort(function(a, b) {
			let first = a[sortBy].toLowerCase();
			let second = b[sortBy].toLowerCase();
			if(first < second) return -1;
			if(first > second) return 1;
			return 0;
		});
	}

	// render the entries
	let html = '';
	addressBookEntries.forEach((item) => {
		html += itemAddressBook(item);
	});
	document.querySelector('#addressbook-container').innerHTML = html;
	listenToAddressBookEvents();
}

function handleAddressBook() {
	// save button
	addressBookButtonSave.addEventListener('click', () => {
		formMessageReset();

		let addressValue = addressBookInputWallet.value ? addressBookInputWallet.value.trim() : '';
		let nameValue = addressBookInputName.value ? addressBookInputName.value.trim() : '';
		let paymentIdValue = addressBookInputPaymentId.value ? addressBookInputPaymentId.value.trim() : '';
		let entryHash = wsutil.b2sSum(addressValue + paymentIdValue);
		let isUpdate = addressBookInputUpdate.value ? addressBookInputUpdate.value : 0;

		if (!nameValue || !addressValue) {
			formMessageSet('addressbook','error', translateString("addressbook_js_addr_empty"));
			return;
		}

		if (!wsutil.validateAddress(addressValue)) {
			formMessageSet('addressbook','error', `${translateString("addressbook_js_addr_invalid")} ${config.assetName} ${translateString("addressbook_js_addr")}`);
			return;
		}

		if (paymentIdValue.length) {
			if (!wsutil.validatePaymentId(paymentIdValue)) {
				formMessageSet('addressbook','error', translateString("addressbook_js_invalid_paymentid"));
				return;
			}
		}

		if (addressValue.length > 99) paymentIdValue.value = '';

		if (abook.has(entryHash) && !isUpdate) {
			formMessageSet('addressbook','error', translateString("addressbook_js_addr_exists"));
			return;
		}

		if (abook.has(entryHash)) {
			abook.delete(entryHash);
		}

		let newAddr = {
			name: nameValue,
			address: addressValue,
			paymentId: paymentIdValue,
			qrCode: wsutil.genQrDataUrl(addressValue)
		};
		abook.set(entryHash, newAddr);
		formMessageSet('addressbook', 'success', translateString("addressbook_js_addr_saved"));

		addressBookInputWallet.value = '';
		addressBookInputName.value = '';
		addressBookInputPaymentId.value = '';
		addressBookInputUpdate.value = 0;
		listAddressBook(true);
	});

	// order by button
	addressBookSelectOrder.addEventListener('click', () => {
		if (addressBookSelectOrder.value == 'name') {
			listAddressBook(true, 'name');
		} else if (addressBookSelectOrder.value == 'address') {
			listAddressBook(true, 'address');
		} else {
			listAddressBook(true);
		}
	});
	listAddressBook();
}

function handleWalletOpen(){
	if(settings.has('recentWallet')){
		walletOpenInputPath.value = settings.get('recentWallet');
	}

	function setOpenButtonsState(isInProgress){
		isInProgress = isInProgress ? 1 : 0;
		if(isInProgress){
			walletOpenButtons.classList.add('hidden');
		}else{
			walletOpenButtons.classList.remove('hidden');
		}
	}

	walletOpenButtonOpen.addEventListener('click', () => {
		formMessageReset();
		// node settings thingy
		let daemonHostValue = settingsInputDaemonAddress.value ? settingsInputDaemonAddress.value.trim() :'';
		let daemonPortValue = settingsInputDaemonPort.value ? parseInt(settingsInputDaemonPort.value.trim(),10) : '';

		// validate hostname
		if(!daemonHostValue.length || !Number.isInteger(daemonPortValue)){
			formMessageSet('load','error', translateString("system_opening_node_warning"));
			return false;
		}

		let validHost = daemonHostValue === 'localhost' ? true : false;
		if(require('net').isIP(daemonHostValue)) validHost = true;
		if(!validHost){
			let domRe = new RegExp(/([a-z])([a-z0-9]+\.)*[a-z0-9]+\.[a-z.]+/i);
			if(domRe.test(daemonHostValue)) validHost = true;
		}
		if(!validHost){
			formMessageSet('load','error', translateString("system_invalid_node_addr"));
			return false;
		}

		// validate port
		if(daemonPortValue <= 0 || daemonPortValue > 65534){
			formMessageSet('load','error', translateString("system_invalid_node_port"));
			return false;
		}

		// validate password
		if(!walletOpenInputPassword.value){
			formMessageSet('load','error', translateString("system_invalid_password"));
			return;
		}

		let settingVals = {
			service_bin: settings.get('service_bin') || "DNX-service",
			node_bin: settings.get('node_bin') || "DNX-node",
			wrapped_addr: settings.get('wrapped_addr') || "",
			qnode_subgrp: settings.get('qnode_subgrp') || "",
			language: settings.get('language') || "en",
			daemon_host: daemonHostValue,
			daemon_port: daemonPortValue,
			tray_minimize: settings.get('tray_minimize'),
			tray_close: settings.get('tray_close')
		};
		initSettingVal(settingVals);

		// actually open wallet
		if(!walletOpenInputPath.value){
			formMessageSet('load','error', translateString("system_invalid_wallet_path"));
			WALLET_OPEN_IN_PROGRESS = false;
			setOpenButtonsState(0);
			return;
		}

		function onError(err){
			formMessageReset();
			if (err == 'Failed to load your wallet, please check your password') {
				formMessageSet('load','error', translateString("system_invalid_unable_to_open1") + '<br />' + translateString("system_invalid_unable_to_open2"));
			} else {
				formMessageSet('load','error', err);
			}
			WALLET_OPEN_IN_PROGRESS = false;
			setOpenButtonsState(0);
			return false;
		}

		function onSuccess(){
			walletOpenInputPath.value = settings.get('recentWallet');
			overviewWalletAddress.value = wsession.get('loadedWalletAddress');
			WALLET_OPEN_IN_PROGRESS = false;
			changeSection('section-overview');
			setTimeout(()=>{
				setOpenButtonsState(0);
			},300);
		}

		function onDelay(msg){
			formMessageSet('load','warning', `${msg}<br><progress></progress>`);
		}

		let walletFile = walletOpenInputPath.value;
		let walletPass = walletOpenInputPassword.value;

		fs.access(walletFile, fs.constants.R_OK, (err) => {
			if(err){
				formMessageSet('load','error', translateString("system_invalid_wallet_path"));
				setOpenButtonsState(0);
				WALLET_OPEN_IN_PROGRESS = false;
				return false;
			}

			setOpenButtonsState(1);
			WALLET_OPEN_IN_PROGRESS = true;
			settings.set('recentWallet', walletFile);
			settings.set('recentWalletDir', path.dirname(walletFile));
			formMessageSet('load','warning', translateString("system_accessing_wallet") + "<br><progress></progress>");
			wsmanager.stopService().then(() => {

				formMessageSet('load','warning', translateString("system_starting_wallet_service") + "<br><progress></progress>");
				setTimeout(() => {
					formMessageSet('load','warning', translateString("system_opening") + "<br><progress></progress>");
					wsmanager.startService(walletFile, walletPass, onError, onSuccess, onDelay);
				},800);
			}).catch((err) => {
				console.log(err);
				formMessageSet('load','error', translateString("system_error_wallet_service"));
				WALLET_OPEN_IN_PROGRESS = false;
				setOpenButtonsState(0);
				return false;
			});
		});
	});
}

function handleWalletLocked(){
	if(settings.has('recentWallet')){
		walletOpenInputPath.value = settings.get('recentWallet');
	}

	function setOpenButtonsState(isInProgress){
		isInProgress = isInProgress ? 1 : 0;
		if(isInProgress){
			walletLockedButtons.classList.add('hidden');
		}else{
			walletLockedButtons.classList.remove('hidden');
		}
	}

	walletLockedButtonOpen.addEventListener('click', () => {
		formMessageReset();

		// validate password
		if(!walletLockedInputPassword.value){
			formMessageSet('unlock','error', translateString("system_invalid_password"));
			return;
		}

		let walletFile = walletOpenInputPath.value;
		let walletPass = walletLockedInputPassword.value;

		fs.access(walletFile, fs.constants.R_OK, (err) => {		
			function onError(err){
				formMessageReset();
				if (err == 'Failed to load your wallet, please check your password') {
					formMessageSet('unlock','error', translateString("system_invalid_unable_to_open2"));
				} else {
					formMessageSet('unlock','error', err);
				}
				setOpenButtonsState(0);
				return false;
			}

			function onSuccess() {
				setTimeout(() => {
					lockWallet(true);
					setOpenButtonsState(0);
					if(TXLIST_OBJ) {
						TXLIST_OBJ.clear();
						TXLIST_OBJ.update();
					}
				}, 300);
			}

			function onDelay(msg){
				formMessageSet('unlock','warning', `${msg}<br><progress></progress>`);
			}			

			setOpenButtonsState(1);
			formMessageSet('unlock','warning', translateString("system_validating_password") + "<br><progress></progress>");

			// Validate wallet password using the checksum method
			wsmanager.stopService().then(() => {
				setTimeout(() => {
					wsmanager.startService(walletFile, walletPass, onError, onSuccess, onDelay);
				},800);
			}).catch((err) => {
				console.log(err);
				console.log('fail');
			});
		});
	});
}

function handleWalletClose(){
	overviewWalletCloseButton.addEventListener('click', (event) => {
		event.preventDefault();
		if(!confirm(translateString("system_wallet_close_confirm"))) return;

		let dialog = document.getElementById('main-dialog');
		let htmlStr = '<div class="div-save-main" style="text-align: center;padding:1rem;"><i class="fas fa-spinner fa-pulse"></i><span style="padding:0px 10px;">' + translateString("system_wallet_saving_msg") + '</span></div>';
		wsutil.innerHTML(dialog, htmlStr);

		dialog = document.getElementById('main-dialog');
		dialog.showModal();
		// save + SIGTERMed wallet daemon
		wsmanager.stopService().then(() => {
			setTimeout(function(){
				// clear form err msg
				formMessageReset();
				changeSection('section-overview');
				setCssWalletClosed(); // this is not in changeSection function because the section sent was 'section-overview' instead of 'section-welcome'
				cswitch.classList.add('hidden');
				lswitch.classList.add('hidden');
				// update/clear tx
				txInputUpdated.value = 1;
				txInputUpdated.dispatchEvent(new Event('change'));
				// send fake blockUpdated event
				let resetdata = {
					type: 'blockUpdated',
					data: {
						blockCount: -100,
						displayBlockCount: -100,
						knownBlockCount: -100,
						displayKnownBlockCount: -100,
						syncPercent: -100
					}
				};
				wsmanager.notifyUpdate(resetdata);
				dialog = document.getElementById('main-dialog');
				if(dialog.hasAttribute('open')) dialog.close();
				wsmanager.resetState();
				wsutil.clearChild(dialog);
				try{
					if(null !== TXLIST_OBJ){
						TXLIST_OBJ.clear();
						TXLIST_OBJ.update();
					}

					TXLIST_OBJ = null;
				}catch(e){}
				setTxFiller(true);
			}, 1200);
		}).catch((err) => {
			wsmanager.terminateService(true);
			console.log(err);
		});
	});
}

function handleWalletCreate(){
    overviewButtonCreate.addEventListener('click', () => {
        formMessageReset();
        let filePathValue = walletCreateInputPath.value ? walletCreateInputPath.value.trim() : '';
        let passwordValue = walletCreateInputPassword.value ? walletCreateInputPassword.value.trim() : '';
        try {
            const stats = fs.statSync(filePathValue);
            if (stats.isDirectory()) {
                filePathValue = path.join(filePathValue, 'wallet.dynex');
            } else {
                if (!filePathValue.toLowerCase().endsWith('.dynex')) {
                    filePathValue += '.dynex';
                }
            }
        } catch (err) {
            if (!filePathValue.toLowerCase().endsWith('.dynex')) {
                filePathValue += '.dynex';
            }
        }
        let dirName = path.dirname(filePathValue);
        let baseName = path.basename(filePathValue);
        baseName = baseName.replace(/\s+/g, '_');
        filePathValue = path.join(dirName, baseName);

        // validate path
        wsutil.validateWalletPath(filePathValue, DEFAULT_WALLET_PATH).then((finalPath) => {
            // validate password
            if(!passwordValue.length){
                formMessageSet('create','error', translateString("system_wallet_create_passblank"));
                return;
            }

            settings.set('recentWalletDir', path.dirname(finalPath));

            // user already confirm to overwrite
            if(wsutil.isRegularFileAndWritable(finalPath)){
                try{
                    // for now, backup instead of delete, just to be safe
                    let ts = new Date().getTime();
                    let backfn = `${finalPath}.bak.${ts}`;
                    fs.renameSync(finalPath, backfn);
                }catch(err){
                    formMessageSet('create','error', translateString("system_wallet_create_unableoverwrite"));
                    return;
                }
            }

            // create
            wsmanager.createWallet(
                finalPath,
                passwordValue
            ).then((walletFile) => {
                settings.set('recentWallet', walletFile);
                walletOpenInputPath.value = walletFile;
                changeSection('section-overview-load');
                wsutil.showToast(translateString("system_wallet_created"),12000);
            }).catch((err) => {
                formMessageSet('create', 'error', err.message);
                return;
            });
        }).catch((err) => {
            formMessageSet('create','error', err.message);
            return;
        });
    });
}

function handleWalletImportKeys(){
    importKeyButtonImport.addEventListener('click', () => {
        formMessageReset();
        let filePathValue = importKeyInputPath.value ? importKeyInputPath.value.trim() : '';
        let passwordValue = importKeyInputPassword.value ? importKeyInputPassword.value.trim() : '';
        let viewKeyValue = importKeyInputViewKey.value ? importKeyInputViewKey.value.trim() : '';
        let spendKeyValue = importKeyInputSpendKey.value ? importKeyInputSpendKey.value.trim() : '';
        try {
            const stats = fs.statSync(filePathValue);
            if (stats.isDirectory()) {
                filePathValue = path.join(filePathValue, 'imported_wallet.dynex');
            } else {
                if (!filePathValue.toLowerCase().endsWith('.dynex')) {
                    filePathValue += '.dynex';
                }
            }
        } catch (err) {
            if (!filePathValue.toLowerCase().endsWith('.dynex')) {
                filePathValue += '.dynex';
            }
        }
        let dirName = path.dirname(filePathValue);
        let baseName = path.basename(filePathValue);
        baseName = baseName.replace(/\s+/g, '_');
        filePathValue = path.join(dirName, baseName);
        
        // validate path
        wsutil.validateWalletPath(filePathValue, DEFAULT_WALLET_PATH).then((finalPath) => {
            // validate password
            if(!passwordValue.length){
                formMessageSet('import','error', translateString("system_wallet_create_passblank"));
                return;
            }

            // validate keys
            if(!viewKeyValue.length || !spendKeyValue.length){
                formMessageSet('import','error', translateString("system_wallet_blank_key"));
                return;
            }
    
            if(!wsutil.validateSecretKey(viewKeyValue)){
                formMessageSet('import','error', translateString("system_wallet_invalid_viewkey"));
                return;
            }

            if(!wsutil.validateSecretKey(spendKeyValue)){
                formMessageSet('import','error', translateString("system_wallet_invalid_spendkey"));
                return;
            }

            settings.set('recentWalletDir', path.dirname(finalPath));

            // handle existing wallet file
            if(wsutil.isRegularFileAndWritable(finalPath)){
                try{
                    let ts = new Date().getTime();
                    let backfn = `${finalPath}.bak.${ts}`;
                    fs.renameSync(finalPath, backfn);
                }catch(err){
                    formMessageSet('import','error', translateString("system_wallet_create_unableoverwrite"));
                    return;
                }
            }

            // import the wallet
            wsmanager.importFromKeys(
                finalPath,
                passwordValue,
                viewKeyValue,
                spendKeyValue
            ).then((walletFile) => {
                settings.set('recentWallet', walletFile);
                walletOpenInputPath.value = walletFile;
                changeSection('section-overview-load');
                wsutil.showToast(translateString("system_wallet_imported"), 12000);
            }).catch((err) => {
                formMessageSet('import', 'error', err);
                return;
            });
        }).catch((err) => {
            formMessageSet('import','error', err.message);
            return;
        });
    });
}

function handleWalletImportSeed(){
    importSeedButtonImport.addEventListener('click', () => {
        formMessageReset();
        let filePathValue = importSeedInputPath.value ? importSeedInputPath.value.trim() : '';
        let passwordValue = importSeedInputPassword.value ? importSeedInputPassword.value.trim() : '';
        let seedValue = importSeedInputMnemonic.value ? importSeedInputMnemonic.value.trim() : '';
        try {
            const stats = fs.statSync(filePathValue);
            if (stats.isDirectory()) {
                filePathValue = path.join(filePathValue, 'restored_wallet.dynex');
            } else {
                if (!filePathValue.toLowerCase().endsWith('.dynex')) {
                    filePathValue += '.dynex';
                }
            }
        } catch (err) {
            if (!filePathValue.toLowerCase().endsWith('.dynex')) {
                filePathValue += '.dynex';
            }
        }

        let dirName = path.dirname(filePathValue);
        let baseName = path.basename(filePathValue);
        
        baseName = baseName.replace(/\s+/g, '_');
        filePathValue = path.join(dirName, baseName);

        // validate path
        wsutil.validateWalletPath(filePathValue, DEFAULT_WALLET_PATH).then((finalPath) => {
            // validate password
            if(!passwordValue.length){
                formMessageSet('import-seed','error', translateString("system_wallet_create_passblank"));
                return;
            }

            // validate seed
            if(!wsutil.validateMnemonic(seedValue)){
                formMessageSet('import-seed', 'error', translateString("system_wallet_invalid_seed"));
                return;
            }

            settings.set('recentWalletDir', path.dirname(finalPath));

            // handle existing wallet file
            if(wsutil.isRegularFileAndWritable(finalPath)){
                try{
                    let ts = new Date().getTime();
                    let backfn = `${finalPath}.bak.${ts}`;
                    fs.renameSync(finalPath, backfn);
                }catch(err){
                    formMessageSet('import-seed','error', translateString("system_wallet_create_unableoverwrite"));
                    return;
                }
            }

            // import the wallet
            wsmanager.importFromSeed(
                finalPath,
                passwordValue,
                seedValue
            ).then((walletFile) => {
                settings.set('recentWallet', walletFile);
                walletOpenInputPath.value = walletFile;
                changeSection('section-overview-load');
                wsutil.showToast(translateString("system_wallet_imported"), 12000);
            }).catch((err) => {
                formMessageSet('import-seed', 'error', err);
                return;
            });
        }).catch((err) => {
            formMessageSet('import-seed', 'error', err.message);
            return;
        });
    });
}

function handleWalletExport(){
	overviewShowKeyButton.addEventListener('click', () => {
		formMessageReset();
		if(!overviewWalletAddress.value) return;
		wsmanager.getSecretKeys(overviewWalletAddress.value).then((keys) => {
			showkeyInputViewKey.value = keys.viewSecretKey;
			showkeyInputSpendKey.value = keys.spendSecretKey;
			showkeyInputSeed.value = keys.mnemonicSeed;
		}).catch((err) => {
			formMessageSet('secret','error', translateString("system_wallet_failedkey"));
		});
	});

	showkeyButtonExportKey.addEventListener('click', () => {
		formMessageReset();
		let filename = remote.dialog.showSaveDialog({
			title: "Export keys to file...",
			filters: [
				{ name: 'Text files', extensions: ['txt'] }
			  ]
		});
		if(filename){
			wsmanager.getSecretKeys(overviewWalletAddress.value).then((keys) => {
				let textContent = `Wallet Address:${os.EOL}${wsession.get('loadedWalletAddress')}${os.EOL}`;
				textContent += `${os.EOL}View Secret Key:${os.EOL}${keys.viewSecretKey}${os.EOL}`;
				textContent += `${os.EOL}Spend Secret Key:${os.EOL}${keys.spendSecretKey}${os.EOL}`;
				textContent += `${os.EOL}Mnemonic Seed:${os.EOL}${keys.mnemonicSeed}${os.EOL}`;
				try{
					fs.writeFileSync(filename, textContent);
					formMessageSet('secret','success', translateString("system_wallet_keys_exported"));
				}catch(err){
					formMessageSet('secret','error', translateString("system_wallet_keys_exported_fail"));
				}
			}).catch(() => {
				formMessageSet('secret','error', translateString("system_wallet_failedkey"));
			});
		}
	});
}

function handleSendTransfer(){
	sendMaxAmount.addEventListener('click', (event) => {
		let maxsend = event.target.dataset.maxsend || 0;
		if(maxsend) sendInputAmount.value = maxsend;
	});

	sendInputFee.value = 0.001;
	function setPaymentIdState(addr){
		if(addr.length > 99){
			sendInputPaymentId.value = '';
			sendInputPaymentId.setAttribute('disabled', true);
		}else{
			sendInputPaymentId.removeAttribute('disabled');
		}
	}
	sendInputAddress.addEventListener('change', (event) => {
		let addr = event.target.value || '';
		if(!addr.length) initAddressCompletion();
		setPaymentIdState(addr);
	});
	sendInputAddress.addEventListener('keyup', (event) => {
		let addr = event.target.value || '';
		if(!addr.length) initAddressCompletion();
		setPaymentIdState(addr);
	});

	sendButtonSend.addEventListener('click', () => {
		formMessageReset();
		function precision(a) {
			if (!isFinite(a)) return 0;
			let e = 1, p = 0;
			while (Math.round(a * e) / e !== a) { e *= 10; p++; }
			return p;
		}

		let recipientAddress = sendInputAddress.value ? sendInputAddress.value.trim() : '';
		if(!recipientAddress.length || !wsutil.validateAddress(recipientAddress)){
			formMessageSet('send','error', `${translateString("send_addr_error1")} ${config.assetName} ${translateString("send_addr_error2")}`);
			return;
		}

		if(recipientAddress === wsession.get('loadedWalletAddress')){
			formMessageSet('send','error', translateString("send_addr_error3"));
			return;
		}

		let paymentId = sendInputPaymentId.value ? sendInputPaymentId.value.trim() : '';
		if(recipientAddress.length > 99){
			paymentId = '';
		}else if(paymentId.length){
			if(!wsutil.validatePaymentId(paymentId)){
				formMessageSet('send','error', translateString("send_addr_error4"));
				return;
			}
		}

		let total = 0;
		let amount = sendInputAmount.value ? parseFloat(sendInputAmount.value) : 0;
		if (amount <= 0) {
			formMessageSet('send','error', translateString("send_addr_error5"));
			return;
		}

		if (precision(amount) > config.decimalPlaces) {
			formMessageSet('send','error', `${translateString("send_addr_error5")} ${config.decimalPlaces} ${translateString("send_addr_error6")}`);
			return;
		}

		total += amount;
		total = parseFloat(total.toFixed(config.decimalPlaces));
		let txAmount = wsutil.amountForImmortal(amount); // final transfer amount

		let fee = sendInputFee.value ? parseFloat(sendInputFee.value) : 0;
		let minFee = config.minimumFee / config.decimalDivisor;
		if (precision(fee) < minFee) {
			formMessageSet('send','error',`${translateString("send_addr_error7")} ${wsutil.amountForMortal(minFee)}`);
			return;
		}

		if (precision(fee) > config.decimalPlaces) {
			formMessageSet('send','error',`${translateString("send_addr_error8")} ${config.decimalPlaces} ${translateString("send_addr_error6")}`);
			return;
		}

		total += fee;
		total = parseFloat(total.toFixed(config.decimalPlaces));
		let txFee = wsutil.amountForImmortal(fee);

		total = parseFloat(total.toFixed(config.decimalPlaces));
		let txTotal = wsutil.amountForMortal(total);

		const availableBalance = wsession.get('walletUnlockedBalance') || (0).toFixed(config.decimalPlaces);

		if(parseFloat(txTotal) > parseFloat(availableBalance)){
			formMessageSet(
				'send',
				'error', 
				`${translateString("send_addr_error9")}: ${(txTotal)} ${config.assetName}`
			);
			return;
		}

		let tx = {
			address: recipientAddress,
			amount: txAmount,
			fee: txFee
		};

		if(paymentId.length) tx.paymentId = paymentId;
		let tpl = `
			<div class="div-transaction-panel">
				<h4>${translateString("send_js_transfer_confirmation")}</h4>
				<div class="transferDetail">
					<p>${translateString("send_js_transfer_plzconfirm")}</p>
					<dl>
						<dt class="dt-ib">${translateString("send_js_transfer_recipient")}:</dt>
						<dd class="dd-ib">${tx.address}</dd>
						<dt class="${paymentId.length ? 'dt-ib' : 'hidden'}">${translateString("send_js_paymentid")}:</dt>
						<dd class="${paymentId.length ? 'dd-ib' : 'hidden'}">${paymentId.length ? paymentId : 'N/A'}</dd>
						<dt class="dt-ib">${translateString("send_js_transfer_amount")}:</dt>
						<dd class="dd-ib">${amount} ${config.assetTicker}</dd>
						<dt class="dt-ib">${translateString("send_js_transfer_fee")}:</dt>
						<dd class="dd-ib">${fee} ${config.assetTicker}</dd>
						<dt class="dt-ib">${translateString("send_js_transfer_total")}:</dt>
						<dd class="dd-ib">${total} ${config.assetTicker}</dd>
					</dl>
				</div>
			</div>
			<div class="div-panel-buttons">
				<button data-target='#tf-dialog' type="button" class="form-bt button-gray dialog-close-default" id="button-send-ko">${translateString("send_js_cancel_button")}</button>
				<button data-target='#tf-dialog' type="button" class="form-bt button-blue" id="button-send-ok">${translateString("send_js_send_button")}</button>
			</div>`;

		let dialog = document.getElementById('tf-dialog');
		wsutil.innerHTML(dialog, tpl);
		dialog = document.getElementById('tf-dialog');
		dialog.showModal();

		let sendBtn = dialog.querySelector('#button-send-ok');

		sendBtn.addEventListener('click', (event) => {
			let md = document.querySelector(event.target.dataset.target);
			md.close();
			formMessageSet('send', 'warning', translateString("send_js_sending_wait") + '<br><progress></progress>');
			wsmanager.sendTransaction(tx).then((result) => {
				formMessageReset();
				let txhashUrl = `<a class="external" title="${translateString("send_js_sent_viewexplorer")}" href="${config.blockExplorerTransactionUrl.replace('[[TX_HASH]]', result.transactionHash)}">${result.transactionHash}</a>`;
				let okMsg = `${translateString("send_js_sent_confirmed")}<br>TX: ${txhashUrl}.<br>${translateString("send_js_sent_balancewrong")}`;
				formMessageSet('send', 'success', okMsg);
				// check if it's new address, if so save it
				let newId = wsutil.b2sSum(recipientAddress);
				if(!abook.has(newId)){
					let now = new Date().toISOString();
					let newName = `unnamed (${now.split('T')[0].replace(/-/g,'')}_${now.split('T')[1].split('.')[0].replace(/:/g,'')})`;
					let newAddr = {
						name: newName,
						address: recipientAddress,
						paymentId: paymentId,
						qrCode: wsutil.genQrDataUrl(recipientAddress)
					};
					abook.set(newId,newAddr);
				}
				sendInputAddress.value = '';
				sendInputPaymentId.value = '';
				sendInputAmount.value = '';
			}).catch((err) => {
				formMessageSet('send', 'error', `${translateString("send_js_sent_failed")}:<br><small>${err}</small>`);
			});
			wsutil.clearChild(md);
		});
	});
	
	bridgeButtonSend.addEventListener('click', () => {
		formMessageReset();
		function precision(a) {
			if (!isFinite(a)) return 0;
			let e = 1, p = 0;
			while (Math.round(a * e) / e !== a) { e *= 10; p++; }
			return p;
		}

		let bridgeChainID = bridgeInputChainID.value ? bridgeInputChainID.value.trim() : '';
		if(!bridgeChainID.length){
			formMessageSet('send','error2', translateString("send_js_bridge_badchain"));
			return;
		}		
		let recipientAddress = bridgeInputToAddr.value ? bridgeInputToAddr.value.trim() : '';
		if(!recipientAddress.length || !wsutil.validateEthAddress(recipientAddress)){
			formMessageSet('send','error2', translateString("send_js_bridge_badaddr1"));
			return;
		}
		let amount = bridgeInputAmount.value ? parseFloat(bridgeInputAmount.value) : 0;
		if (amount <= 0) {
			formMessageSet('send','error2', translateString("send_js_bridge_badamount"));
			return;
		}
		if (precision(amount) > config.decimalPlaces) {
			formMessageSet('send','error2', `${translateString("send_js_bridge_decimals1")} ${config.decimalPlaces} ${translateString("send_js_bridge_decimals2")}`);
			return;
		}		
		amount = (amount * 1000000000)			// Make sure the Amount is always 9 Decimals

		request({
			uri: 'https://bridge.dynexcoin.org/api/bridge/payment_details?address=' + recipientAddress + '&chainID=' + bridgeChainID,
			method: 'GET',
			json: true,
			timeout: 3000
		}).then((res) => {
			if (!res) return resolve(true);
			if (!res.error) {
				log.debug("[dnx-bridge] Send To:", recipientAddress);							
				// Comes from Bridge API
				let bridgeWalletAddr = res.bridge_dnx_address;
				let paymentId = res.payment_id;
				let bridgeFee = res.dnx_bridge_fee;

				let total = 0;
				total += amount;
				total = parseFloat(total.toFixed(config.decimalPlaces));

				total += bridgeFee;
				total = parseFloat(total.toFixed(config.decimalPlaces));
				
				var formattedAmount = (amount / 1000000000)
				var formattedTxFee = (bridgeFee / 1000000000)
				var formattedTxTotal = (total / 1000000000)				
				
				const availableBalance = wsession.get('walletUnlockedBalance') || (0).toFixed(config.decimalPlaces);
				if(parseFloat(total) > (parseFloat(wsession.get('walletUnlockedBalance')) * 1000000000)) {
					formMessageSet(
						'send',
						'error2', 
						`${translateString("send_addr_error9")}: ${(formattedTxTotal)} ${config.assetName}`
					);
					return;
				}

				const getNetworkName = (type) => {
				  switch (type) {
					case "1":
					  return "Ethereum";
					case "2":
					  return "Base";
					default:
					  return "Unknown";
				  }
				};
				let bridgeChainName = getNetworkName(bridgeChainID);
				let tx = {
					chain_id: bridgeChainID,
					chain_name: bridgeChainName,
					address: bridgeWalletAddr,
					wrapped_address: recipientAddress,
					paymentId: paymentId,
					amount: amount,
					fee: bridgeFee,
					total: total
				};

				let tpl = `
					<div class="div-transaction-panel">
						<h4>${translateString("send_js_bridge_plzconfirm")}</h4>
						<div class="transferDetail">
							<p>${translateString("send_js_bridge_chain")}</p>
							<dl>
								<dt class="dt-ib">${translateString("send_js_bridge_chain")}:</dt>
								<dd class="dd-ib">${tx.chain_name}</dd>
								<dt class="dt-ib">${translateString("send_js_bridge_chainid")}:</dt>
								<dd class="dd-ib">${tx.wrapped_address}</dd>
								<dt class="dt-ib">${translateString("send_js_bridge_amount")}:</dt>
								<dd class="dd-ib">${formattedAmount} ${config.assetTicker}</dd>
								<dt class="dt-ib">${translateString("send_js_bridge_fee")}:</dt>
								<dd class="dd-ib">${formattedTxFee} ${config.assetTicker}</dd>
								<dt class="dt-ib">${translateString("send_js_bridge_total")}:</dt>
								<dd class="dd-ib">${formattedTxTotal} ${config.assetTicker}</dd>
							</dl>
						</div>
					</div>
					<div class="div-panel-buttons">
						<button data-target='#tf-dialog' type="button" class="form-bt button-gray dialog-close-default" id="button-send-bridge-ko">${translateString("send_js_bridge_cancel_button")}</button>
						<button data-target='#tf-dialog' type="button" class="form-bt button-blue" id="button-send-bridge-ok">${translateString("send_js_bridge_send_button")}</button>
					</div>`;

				let dialog = document.getElementById('tf-dialog');
				wsutil.innerHTML(dialog, tpl);
				dialog = document.getElementById('tf-dialog');
				dialog.showModal();

				let bridgeSendBtn = dialog.querySelector('#button-send-bridge-ok');
				bridgeSendBtn.addEventListener('click', (event) => {
					let md = document.querySelector(event.target.dataset.target);
					md.close();
					formMessageSet('send', 'warning2', translateString("send_js_bridge_sending_wait") + '<br><progress></progress>');
					wsmanager.sendTransaction(tx).then((result) => {
						formMessageReset();					
						let txhashUrl = `<a class="external" title="${translateString("send_js_bridge_sent_viewexplorer")}" href="${config.blockExplorerTransactionUrl.replace('[[TX_HASH]]', result.transactionHash)}">${result.transactionHash}</a>`;
						let okMsg = `${translateString("send_js_bridge_sent_confirmed")}<br>TX: ${txhashUrl}.<br>${translateString("send_js_bridge_sent_balancewrong")}`;						
						
						formMessageSet('send', 'success2', okMsg);
						// After Bridge Succesful transaction - Reset the values to blank for next bridge transaction
						bridgeInputChainID.value = 1;
						bridgeInputToAddr.value = '';
						bridgeInputAmount.value = '';
					}).catch((err) => {
						formMessageSet('send', 'error2', `${translateString("send_js_bridge_sent_failed")}:<br><small>${err}</small>`);
					});
					wsutil.clearChild(md);
				});
			}
		}).catch((err) => {
			log.debug("[dnx-bridge]", "error fetching from api - " + err);
		});	
	});	

	sendOptimize.addEventListener('click', () => {
		if(!wsession.get('synchronized', false)){
			wsutil.showToast(translateString("system_synchronization"));
			return;
		}

        if (wsession.get('fusionProgress')) {
            wsutil.showToast(translateString("system_optimization"));
            return;
        }

		if(!confirm(translateString("system_optimization_confirm"))) return;
		wsutil.showToast(translateString("system_optimization_started"), 3000);
		//FUSION_IN_PROGRESS = true;
		let fusionProgressBar = document.getElementById('fusion-progress');
		fusionProgressBar.classList.remove('hidden');
		sendOptimize.classList.add('hidden');
        wsession.set('fusionProgress', true);

		log.debug(`Started wallet optimization`);
		wsmanager.optimizeWallet().then( (res) => {
			//FUSION_IN_PROGRESS = false;
			// do nothing, just wait
		}).catch((err) => {
			//FUSION_IN_PROGRESS = false;
			// do nothing, just wait
		});
		return; // just return, it will notify when its done.
	});
}
async function getNonPrivacyInformation(txHash) {
	log.debug("[tx-lookup] ", txHash);
	if (txHash != '' && txHash != null && txHash != undefined) {
		var dynexAuth = Buffer.from('dynex:dynex', 'utf8').toString('base64');		
		return new Promise((resolve, reject) => {
            var params = {
                hash: txHash
            };			
			timeout = 3000;
			let data = {
				jsonrpc: '2.0',
				id: 1,
				method: 'gettransaction',
				params: params,
			};
			request({
				uri: 'http://127.0.0.1:18333/json_rpc',
				method: 'POST',
				headers: {
					Connection: 'keep-alive',
					Authorization: 'Basic ' + dynexAuth
				},
				body: data,
				json: true,
				timeout: timeout
			}).then((res) => {
				if (!res) return resolve(true);
				if (!res.error) {
					if (res.result) return resolve(res.result);
					return resolve(res);
				} else {
					return reject(res.error.message);
				}
			}).catch((err) => {
				return reject(err);
			});
		});	
	}
}
function hexToBinaryAndDecimal(hexString) {
    // Remove leading "0x" if present
    if (hexString.startsWith("0x")) {
        hexString = hexString.slice(2);
    }
    // Convert Hexadecimal to Binary
    const hexToBinMap = {
        '0': '0000', '1': '0001', '2': '0010', '3': '0011',
        '4': '0100', '5': '0101', '6': '0110', '7': '0111',
        '8': '1000', '9': '1001', 'A': '1010', 'B': '1011',
        'C': '1100', 'D': '1101', 'E': '1110', 'F': '1111'
    };
    let binaryString = '';
    for (const char of hexString.toUpperCase()) {
        binaryString += hexToBinMap[char] || '';
    }
    // Convert Hexadecimal to Decimal without BigInt
    let decimalValue = 0;
    for (let i = 0; i < hexString.length; i++) {
        const hexDigit = parseInt(hexString[i], 16);
        decimalValue = decimalValue * 16 + hexDigit;
    }
    return {
        binary: binaryString.replace(/^0+/, ''), // Remove leading zeros in binary
        decimal: decimalValue,
        dnx: (decimalValue / 1000000000)
    };
}
function handleTransactions(){
	// tx list options
	var itemF = function(item) {
		let tDate = (function() {
			var d = new Date(item.timeStr);
			var m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			
			var hours = d.getHours();
			var minutes = d.getMinutes();
			var seconds = d.getSeconds();

			if (hours<10) hours = "0" + hours;
			if (minutes<10) minutes = "0" + minutes;			
			if (seconds<10) seconds = "0" + seconds;			
			
			return d.getDate() + ' ' + m[d.getMonth()] + ' ' + d.getFullYear() + ' - ' + hours + ':' + minutes + ':' + seconds;
		})();
		let status = item.txType == 'in' ? '<span class="rcv">' + translateString("transactions_js_received") + '</span><img src="../assets/transactions/arrow-down-green.png" />' : '<span class="snt">' + translateString("transactions_js_sent") + '</span><img src="../assets/transactions/arrow-up-red.png" />';
		let hash = item.transactionHash.substring(0, 10) + '...' + item.transactionHash.slice(-10);
		let paymentId = "";
		let confirmationsIco = "";
		if (item.confirmations <= 8) { 
			confirmationsIco = '<i class="fa fa-spinner fa-spin"></i>'; 
			// Perform replacements and reassign the modified string to status
			status = status.replace(
				translateString("transactions_js_received"),
				translateString("transactions_js_confirming")
			).replace(
				translateString("transactions_js_sent"),
				translateString("transactions_js_confirming")
			);
		}
		if (item.paymentId != '-') { paymentId = item.paymentId.substring(0, 10) + '...' + item.paymentId.slice(-10); }
		return `<tr title="${translateString("transactions_js_click_details")}" class="txlist-item">
			<td class="tx-date">
				<img src="../assets/general/arrow-left-white.png" /><span>${tDate}</span>
			</td>
			<td class="tx-ov-info">
				<span>${hash}</span>
			</td>
			<td class="txinfo">
				<p class="tx-ov-info">${paymentId}</p>
			</td>
			<td class="txamount">
				<span class="amount"></span> ${config.assetTicker}
			</td>
			<td class="txstatus">${confirmationsIco} ${status}</td>
		</tr>`
	};
	let txListOpts = {
		valueNames: [
			{ data: [
				'rawPaymentId', 'rawHash', 'txType', 'rawAmount', 'rawFee', 'destinationAddress',
				'fee', 'timestamp', 'blockIndex', 'extra', 'isBase', 'unlockTime', 'confirmations'
			]},
			'amount','timeStr','paymentId','transactionHash','fee'
		],
		item: itemF,
		searchColumns: ['transactionHash','paymentId','timeStr','amount'],
		indexAsync: true
	};
	// tx detail
	async function showTransaction(el){
		let tx = (el.name === "tr" ? el : el.closest('tr'));
		let txdate = new Date(tx.dataset.timestamp*1000).toUTCString();
		let txhashUrl = `<a class="external form-bt button-blue" title="${translateString("transactions_js_viewin_blockexplorer")}" href="${config.blockExplorerTransactionUrl.replace('[[TX_HASH]]', tx.dataset.rawhash)}">${translateString("transactions_js_viewin_blockexplorer")}</a>`;
		let txTypeBtn = tx.dataset.txtype == 'in' ? `<a class="tx-type-btn tx-type-in">${translateString("transactions_js_received")}<img src="../assets/transactions/right-blue-arrow.png" /></a>` : `<a class="tx-type-btn tx-type-out">${translateString("transactions_js_sent")}<img src="../assets/transactions/arrow-up-red.png" /></a>`;
		let address = tx.dataset.txtype == 'in' ? wsession.get('loadedWalletAddress') : tx.dataset.destinationaddress;
		var extraDataDecoded = await getNonPrivacyInformation(tx.dataset.rawhash);
		var confirmationNumber = tx.dataset.confirmations;
		if (tx.dataset.confirmations > 8) { confirmationNumber = '<span class="cyan">' + translateString("transactions_js_confirmed") + '</span>'; }
		
		let dialogTpl = `
				<div class="div-transactions-panel">
					<div class="clearfix">
						<button data-target="#tx-dialog" type="button" class="form-bt button-blue dialog-close-default" id="button-transactions-panel-close">${translateString("transactions_js_back")}</button>

						<div class="div-title clearfix">
							<img src="../assets/transactions/title.png" />
							<h2 class="title">${translateString("transactions_js_transaction_detail")}</h2>
							<div class="subtitle">${translateString("transactions_js_chain_info")}</div>
						</div>
					</div>

					<div class="transactions-panel-table">
						<table class="custom-table" id="transactions-panel-table">
							<tbody>
								<tr>
									<th scope="col"><img src="../assets/transactions/right-blue-arrow.png" /><span class="opa50">TX</span></th>
									<td><span class="opa50 tctcl" data-cplabel="Tx. hash">${tx.dataset.rawhash}</span></td>
								</tr>
								<tr>
									<th scope="col"><img src="../assets/transactions/right-blue-arrow.png" /><span class="opa50">${translateString("transactions_js_timestamp")}</span></th>
									<td><span class="opa50 tctcl" data-cplabel="Tx. date">${tx.dataset.timestamp} (${txdate})</span></td>
								</tr>
								<tr>
									<th scope="col"><img src="../assets/transactions/right-blue-arrow.png" /><span class="opa50">${translateString("transactions_js_height")}</span></th>
									<td><span class="opa50 tctcl" data-cplabel="Tx. block index">${tx.dataset.blockindex}</span></td>
								</tr>
								<tr>
									<th scope="col"><img src="../assets/transactions/right-blue-arrow.png" /><span class="opa50">${translateString("transactions_js_confirmations")}</span></th>
									<td><span class="opa50">${confirmationNumber}</span></td>
								</tr>								
								<tr>
									<th scope="col"><img src="../assets/transactions/right-blue-arrow.png" />${translateString("transactions_js_amount")}</th>
									<td data-cplabel="Tx. amount" class="tctcl">${tx.dataset.rawamount} ${config.assetTicker}</td>
								</tr>
								<tr>
									<th scope="col"><img src="../assets/transactions/right-blue-arrow.png" />${translateString("transactions_js_fee")}</th>
									<td  data-cplabel="Tx. fee" class="tctcl">${tx.dataset.rawfee} ${config.assetTicker}</td>
								</tr>
								<tr>
									<th scope="col"><img src="../assets/transactions/right-blue-arrow.png" />${translateString("transactions_js_addr_from")}</th>
									<td data-cplabel="Address" class="tctcl" id="tx_addr_from">${extraDataDecoded.transaction.address_from}</td>
								</tr>
								<tr>
									<th scope="col"><img src="../assets/transactions/right-blue-arrow.png" />${translateString("transactions_js_addr_to")}</th>
									<td data-cplabel="Address" class="tctcl" id="tx_addr_to">									
			`;	
							// Dynex Non Privacy Upgrade
							if (extraDataDecoded['transaction']['address_to'].length > 1) {
								// Detected Multiple Payments Address_To
								for (let index = 0; index < extraDataDecoded['transaction']['address_to'].length; ++index) {
									const elementAddrTo = extraDataDecoded['transaction']['address_to'][index];
									const elementAmount = hexToBinaryAndDecimal(extraDataDecoded['transaction']['amount'][index]);
									dialogTpl += `<div style="float: left; width: 90%; font-size: 13px; vertical-align: middle;">${elementAddrTo}</div>`;
									dialogTpl += `<div style="float: right; width: 10%; font-size: 13px; vertical-align: middle;">${elementAmount.dnx} ${config.assetTicker}</div>`;
								}
							} else {
								// Detected Only 1 Address_To 
								dialogTpl += `<span>${extraDataDecoded['transaction']['address_to'][0]}</span>`;
							}
			dialogTpl += `			</td>
								</tr>
								<tr class="hidden">
									<th scope="col"><img src="../assets/transactions/right-blue-arrow.png" /><span class="opa50">Extra</span></th>
									<td><span class="opa50 tctcl" data-cplabel="Tx. extra">${tx.dataset.extra}</span></td>
								</tr>
								<tr>
									<th scope="col"><img src="../assets/transactions/right-blue-arrow.png" /><span class="opa50">${translateString("transactions_js_paymentid")}</span></th>
									<td><span class="opa50 tctcl" data-cplabel="Payment ID">${tx.dataset.rawpaymentid}</span></td>
								</tr>
							</tbody>
						</table>
						${txTypeBtn}
					</div>
					<div>${txhashUrl}</div>
				</div>
			`;

		let dialog = document.getElementById('tx-dialog');
		wsutil.innerHTML(dialog, dialogTpl);
		dialog = document.getElementById('tx-dialog');
		dialog.showModal();
	}

	function sortAmount(a, b){
		var aVal = parseFloat(a._values.amount.replace(/[^0-9.-]/g, ""));
		var bVal = parseFloat(b._values.amount.replace(/[^0-9.-]/g, ""));
		if (aVal > bVal) return 1;
		if (aVal < bVal) return -1;
		return 0;
	}

	function resetTxSortMark(){
		let sortedEl = document.querySelectorAll('#transaction-lists .asc, #transaction-lists .desc');
		Array.from(sortedEl).forEach((el)=>{
			el.classList.remove('asc');
			el.classList.remove('desc');
		});
	}

	function listTransactions(){
		if(wsession.get('txLen') <= 0){
			setTxFiller(true);
			return;
		}

		let txs = wsession.get('txNew');
		if(!txs.length) {
			if(TXLIST_OBJ === null || TXLIST_OBJ.size() <= 0) setTxFiller(true);
			return;
		}

		setTxFiller(false);
		let txsPerPage = 10;
		if(TXLIST_OBJ === null){
			if(txs.length > txsPerPage){
				txListOpts.page = txsPerPage;
				txListOpts.pagination = [{
					innerWindow: 2,
					outerWindow: 1
				}]; 
			}
			TXLIST_OBJ = new List('transaction-lists', txListOpts, txs);
			TXLIST_OBJ.sort('timestamp', {order: 'desc'});
			resetTxSortMark();
			txButtonSortDate.classList.add('desc');
			txButtonSortDate.dataset.dir = 'desc';
		}else{
			setTxFiller(false);
			TXLIST_OBJ.add(txs);
			TXLIST_OBJ.sort('timestamp', {order: 'desc'});
			resetTxSortMark();
			txButtonSortDate.classList.add('desc');
			txButtonSortDate.dataset.dir = 'desc';
		}
	}

	function exportAsCsv(mode){
		if(wsession.get('txLen') <= 0) return;

		formMessageReset();
		mode = mode || 'all';
		let recentDir = settings.get('recentWalletDir', remote.app.getPath('documents'));
		let filename = remote.dialog.showSaveDialog({
			title: "Export transactions as csv...",
			defaultPath: recentDir,
			filters: [
				{ name: 'CSV files', extensions: ['csv'] }
			  ]
		});
		if(!filename) return;

		const createCsvWriter  = require('csv-writer').createObjectCsvWriter;
		const csvWriter = createCsvWriter({
			path: filename,
			header: [
				{id: 'timeStr', title: 'Time'},
				{id: 'amount', title: 'Amount'},
				{id: 'paymentId', title: 'PaymentId'},
				{id: 'transactionHash', title: 'Transaction Hash'},
				{id: 'fee', title: 'Transaction Fee'},
				{id: 'extra', title: 'Extra Data'},
				{id: 'blockIndex', title: 'Block Height'}
			]
		});
		let rawTxList = wsession.get('txList');
		let txlist = rawTxList.map((obj) => {
			return {
				timeStr: obj.timeStr,
				amount: obj.amount,
				paymentId: obj.paymentId,
				transactionHash: obj.transactionHash,
				fee: obj.fee,
				extra: obj.extra,
				blockIndex: obj.blockIndex,
				txType: obj.txType
			};
		});

		let dialog = document.getElementById('ab-dialog');
		switch(mode){
			case 'in':
				let txin = txlist.filter( (obj) => {return obj.txType === "in";});
				if(!txin.length){
					wsutil.showToast(translateString("transactions_js_export_failed"));
					if(dialog.hasAttribute('open')) dialog.close();
					return;
				}

				csvWriter.writeRecords(txin).then(()=>{
					if(dialog.hasAttribute('open')) dialog.close();
					wsutil.showToast(`${translateString("transactions_js_exportedto")} ${filename}`);
				}).catch((err) => {
					if(dialog.hasAttribute('open')) dialog.close();
					wsutil.showToast(`${translateString("transactions_js_exportedto_fail")}, ${err.message}`);
				});
				break;
			case 'out':
				let txout = txlist.filter( (obj) => {return obj.txType === "out";});
				if(!txout.length){
					wsutil.showToast('Transaction export failed, outgoing transactions not available!');
					if(dialog.hasAttribute('open')) dialog.close();
					return;
				}

				csvWriter.writeRecords(txout).then(()=>{
					if(dialog.hasAttribute('open')) dialog.close();
					wsutil.showToast(`${translateString("transactions_js_exportedto")} ${filename}`);
				}).catch((err) => {
					if(dialog.hasAttribute('open')) dialog.close();
					wsutil.showToast(`${translateString("transactions_js_exportedto_fail")}, ${err.message}`);
				});
				break;
			default:
				csvWriter.writeRecords(txlist).then(()=>{
					if(dialog.hasAttribute('open')) dialog.close();
					wsutil.showToast(`${translateString("transactions_js_exportedto")} ${filename}`);
				}).catch((err) => {
					if(dialog.hasAttribute('open')) dialog.close();
					wsutil.showToast(`${translateString("transactions_js_exportedto_fail")}, ${err.message}`);
				});
				break;
		}
	}

	wsutil.liveEvent('button.export-txtype', 'click', (event) => {
		let txtype = event.target.dataset.txtype || 'all';
		return exportAsCsv(txtype);
	});

	txButtonExport.addEventListener('click', () => {
		let dialogTpl = `<div class="transaction-panel">
			<h4>${translateString("transactions_js_exportto_csv")}:</h4>
			<div class="div-panel-buttons">
				<button data-txtype="all" type="button" class="button-blue export-txtype">${translateString("transactions_js_export_alltransfers")}</button>
				<button data-txtype="in" type="button" class="button-blue export-txtype">${translateString("transactions_js_export_incoming")}</button>
				<button data-txtype="out" type="button" class="button-blue export-txtype">${translateString("transactions_js_export_outgoing")}</button>
				<button data-target="#ab-dialog" type="button" class="button-gray dialog-close-default">${translateString("transactions_js_export_cancel")}</button>
			</div>
		`;
		let dialog = document.getElementById('ab-dialog');
		if(dialog.hasAttribute('open')) dialog.close();
		dialog.innerHTML = dialogTpl;
		dialog.showModal();
	});

	// listen to tx update
	txInputUpdated.addEventListener('change', (event) => {
		let updated = parseInt(event.target.value, 10) === 1;
		if(!updated) return;
		txInputUpdated.value = 0;
		listTransactions();
		handleMempool();
	});
	// listen to tx notify
	txInputNotify.addEventListener('change', (event)=>{
		let notify = parseInt(event.target.value, 10) === 1;
		if(!notify) return;
		txInputNotify.value = 0; // reset
		changeSection('section-transactions');
	});

	// tx detail
	wsutil.liveEvent('.txlist-item', 'click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		return showTransaction(event.target);
	},document.getElementById('transaction-lists'));

	txButtonSortAmount.addEventListener('click',(event)=>{
		event.preventDefault();
		let currentDir = event.target.dataset.dir;
		let targetDir = (currentDir === 'desc' ? 'asc' : 'desc');
		event.target.dataset.dir = targetDir;
		resetTxSortMark();
		event.target.classList.add(targetDir);
		TXLIST_OBJ.sort('amount', {
			order: targetDir,
			sortFunction: sortAmount
		});
	});

	txButtonSortDate.addEventListener('click',(event)=>{
		event.preventDefault();
		let currentDir = event.target.dataset.dir;
		let targetDir = (currentDir === 'desc' ? 'asc' : 'desc');
		event.target.dataset.dir = targetDir;
		resetTxSortMark();
		event.target.classList.add(targetDir);
		TXLIST_OBJ.sort('timestamp', {
			order: targetDir
		});
	});

	txButtonSortStatus.addEventListener('click',(event)=>{
		event.preventDefault();
		let currentDir = event.target.dataset.dir;
		let targetDir = (currentDir === 'desc' ? 'asc' : 'desc');
		event.target.dataset.dir = targetDir;
		resetTxSortMark();
		event.target.classList.add(targetDir);
		TXLIST_OBJ.sort('txType', {
			order: targetDir
		});
	});

	txButtonRefresh.addEventListener('click', (event)=> { 
		listTransactions();
		handleMempool();
	});
}

async function handleMempool() {
    if (isHandlingMempool) { return; } // handleMempool is already running, skipping this call
    isHandlingMempool = true; // Set the flag to true to indicate the function is running
    try {
        if (wsession.get('loadedWalletAddress') !== '') {
			log.debug("[dnx-mempool] checking mempool for new pending transactions");
            let walletAddr = wsession.get('loadedWalletAddress');           
            // Wait for the mempool data
            let result = await wsmanager.loadMempool(walletAddr);
			// Setup of the mempool table
            let mempoolTable = document.getElementById('transaction-list-table2');
            let mempoolTableTbody = document.getElementById('mempoolTbody');
            let tbody = mempoolTable.querySelector('tbody');           
            // Clear all Entries to make sure no duplications
            if (tbody) { tbody.innerHTML = ''; }
            // Deduplicate the transactionHashes array
            let uniqueTransactionHashes = [...new Set(result.transactionHashes)];
            // Process each transaction hash
            for (let index = 0; index < uniqueTransactionHashes.length; ++index) {
                let mempoolTx = uniqueTransactionHashes[index];
                let extraDataDecoded = await getNonPrivacyInformation(mempoolTx);
				// Work out Total Amount
                let amountTotal = 0;
                for (let index2 = 0; index2 < extraDataDecoded['transaction']['amount'].length; ++index2) {
                    let binaryDecimal = hexToBinaryAndDecimal(extraDataDecoded['transaction']['amount'][index2]);
                    amountTotal += binaryDecimal.dnx;
                }
				// Being Sent or Received?
                let inOut = '<span class="rcv">' + translateString("transactions_js_received") + '</span>&nbsp;&nbsp;<img src="../assets/transactions/arrow-down-green.png">';
                if (extraDataDecoded['transaction']['address_from'] === walletAddr) {
                    inOut = '<span class="snt">' + translateString("transactions_js_sent") + '</span>&nbsp;&nbsp;<img src="../assets/transactions/arrow-up-red.png">';
                }
                // Create a new table row
                let newRow = document.createElement('tr');
                let txCell = document.createElement('td');
                txCell.style.width = '50%';
                txCell.innerHTML = mempoolTx.substring(0, 10) + '...' + mempoolTx.slice(-10);
                // Setup the table row cells
                let amountCell = document.createElement('td');
                amountCell.innerHTML = amountTotal + ' ' + config.assetTicker;              
                let feeCell = document.createElement('td');
                feeCell.innerHTML = parseFloat(extraDataDecoded['transaction']['fee'] / 1000000000) + ' ' + config.assetTicker;
                let inOutCell = document.createElement('td');
                inOutCell.innerHTML = inOut;
                // Append the cells to the new row
                newRow.appendChild(txCell);
                newRow.appendChild(amountCell);
                newRow.appendChild(feeCell);
                newRow.appendChild(inOutCell);
                // Append the new row to the table body
                if (tbody) { tbody.appendChild(newRow); }
            }
        }
    } catch (err) {
        log.debug("[dnx-mempool] Error: ", err);
    } finally {
        isHandlingMempool = false; // Reset the flag when the function finishes
    }
}

function handleNetworkChange(){
	window.addEventListener('online', () => {
		let connectedNode = wsession.get('connectedNode');
		if(!connectedNode.length || connectedNode.startsWith('127.0.0.1')) return;
		wsmanager.networkStateUpdate(1);
	});
	window.addEventListener('offline',  () => {
		let connectedNode = wsession.get('connectedNode');
		if(!connectedNode.length || connectedNode.startsWith('127.0.0.1')) return;
		wsmanager.networkStateUpdate(0);
	});
}

// load language pack
async function loadLanguage(lang) {
    // Function to load the selected language JSON file
    try {
        const response = await fetch(`../../resources/lang/${lang}.json`);
        if (!response.ok) throw new Error(`Language file ${lang} not found.`);
        
        const translations = await response.json();
        setTranslations(translations); // Update translations cache globally
        applyTranslations(translations);
        applyAdaptiveTextSize();
        console.debug("[dnx-lang] set language:", lang);
    } catch (error) {
        console.debug('[dnx-lang] Error loading language:', error);
    }
}

// event handlers
function initHelp() {
	const toggleButtons = document.querySelectorAll('.toggleButton');
	const contents = document.querySelectorAll('.content-help');

	toggleButtons.forEach((button, index) => {
		button.addEventListener('click', () => {
		  // Close all content divs
			contents.forEach((content) => {
				content.style.display = 'none';
			});
			// Toggle the clicked content div
			const content = contents[index];
			if (content.style.display === 'none' || content.style.display === '') {
				content.style.display = 'block';
			}
			// Remove 'active' class from all buttons
			toggleButtons.forEach((btn) => btn.classList.remove('active'));
			// Add 'active' class to the clicked button
			button.classList.add('active');
		});
	});
}
function initHandlers(){
	initSectionTemplates();

	// language check (debug only)
	let currentLanguage = settings.get('language') || "en";
	loadLanguage(currentLanguage);

	// netstatus
	handleNetworkChange();

	//external link handler
	wsutil.liveEvent('a.external', 'click', (event) => {
		event.preventDefault();
		shell.openExternal(
			event.target instanceof HTMLImageElement ? 
			event.target.parentElement.getAttribute('href') : 
			event.target.getAttribute('href')
		);
		return false;
	});

	// main section link handler
	for(var ei=0; ei < sectionButtons.length; ei++){
		let target = sectionButtons[ei].dataset.section;
		sectionButtons[ei].addEventListener('click', changeSection.bind(this, target), false);
	}

	// inputs click to copy handlers
	wsutil.liveEvent('textarea.ctcl, input.ctcl', 'click', (event) => {
		let el = event.target;
		let wv = el.value ? el.value.trim() : '';
		let cplabel = el.dataset.cplabel ? el.dataset.cplabel : '';
		let cpnotice = cplabel ? `${cplabel} $(translateString("system_copy_toclipboard"))` : translateString("system_copy_toclipboard");
		el.select();
		if(!wv.length) return;
		clipboard.writeText(wv);
		wsutil.showToast(cpnotice);
	});
	// non-input elements ctc handlers
	wsutil.liveEvent('.tctcl', 'click', (event) => {
		let el = event.target;
		let wv = el.textContent.trim();
		let cplabel = el.dataset.cplabel ? el.dataset.cplabel : '';
		let cpnotice = cplabel ? `${cplabel} $(translateString("system_copy_toclipboard"))` : translateString("system_copy_toclipboard");
		wsutil.selectText(el);
		if(!wv.length) return;
		clipboard.writeText(wv);
		wsutil.showToast(cpnotice);
	});

	// overview page address ctc
	overviewWalletCopyButton.addEventListener('click', function(){
		if(!overviewWalletAddress.value) return;
		let wv = overviewWalletAddress.value;
		let clipInfo = document.getElementById('form-help-wallet-address');
		let origInfo = clipInfo.value;
		if(wv.length >= 10){
			clipboard.writeText(wv.trim());
			clipInfo.textContent = translateString("system_copy_addr_toclipboard");
			clipInfo.classList.add('help-hl');
			setTimeout(function(){
				clipInfo.textContent = origInfo;
				clipInfo.classList.remove('help-hl');
			}, 1800);
		}
	});

	// overview page zoom qr-code
	zoomQrCode.addEventListener('click', function(){
		let generatedQrCode = document.getElementById('qr-gen-img').getAttribute('src');
		let dialogTpl = `<div class="transaction-panel">
			<div class="text-center">
				<h4>${translateString("system_wallet_qrcode")}:</h4>
				<img src="${generatedQrCode}" width="245" />
			</div>
			<div class="div-panel-buttons">
				<button data-target="#ab-dialog" type="button" class="button-gray dialog-close-default">${translateString("system_close_button")}</button>
			</div>
		`;
		let dialog = document.getElementById('ab-dialog');
		if(dialog.hasAttribute('open')) dialog.close();
		dialog.innerHTML = dialogTpl;
		dialog.showModal();
	});

	wsutil.liveEvent('#makePaymentId', 'click', () => {
		let payId = genPaymentId(true);
		let iaf = document.getElementById('genOutputIntegratedAddress');
		document.getElementById('genInputPaymentId').value = payId;
		iaf.value = '';
	});

	wsutil.liveEvent('#doGenIntegratedAddr', 'click', () => {
		formMessageReset();
		let genInputAddress = document.getElementById('genInputAddress');
		let genInputPaymentId = document.getElementById('genInputPaymentId');
		let outputField = document.getElementById('genOutputIntegratedAddress');
		let addr = genInputAddress.value ? genInputAddress.value.trim() : '';
		let pid = genInputPaymentId.value ? genInputPaymentId.value.trim() : '';
		outputField.value = '';
		outputField.removeAttribute('title');
		if(!addr.length || !pid.length){
			formMessageSet('gia','error', 'Address & Payment ID is required');
			return;
		}
		if(!wsutil.validateAddress(addr)){
			formMessageSet('gia','error', `Invalid ${config.assetName} address`);
			return;
		}
		// only allow standard address
		if(addr.length > 99){
			formMessageSet('gia','error', `Only standard ${config.assetName} address are supported`);
			return;
		}
		if(!wsutil.validatePaymentId(pid)){
			formMessageSet('gia','error', 'Invalid Payment ID');
			return;
		}

		wsmanager.genIntegratedAddress(pid, addr).then((res) => {
			formMessageReset();
			outputField.value = res.integratedAddress;
			outputField.setAttribute('title', 'click to copy');
		}).catch((err) => {
			formMessageSet('gia','error', err.message);
		});
	});

	function handleBrowseButton(args){
		if(!args) return;
		let tbtn = document.getElementById(args.targetButton);
		if (tbtn.classList.contains('d-opened')) return;
		tbtn.classList.add('d-opened');

		let dialogType = args.dialogType;
		let targetName = (args.targetName ? args.targetName : 'file');
		let targetInput = args.targetInput;
		let recentDir = settings.get('recentWalletDir', remote.app.getPath('documents'));
		let dialogOpts = {
			defaultPath: recentDir
		};

		if(dialogType === 'saveFile') {
			dialogOpts.title = `Select directory to store your ${targetName}, and give it a filename.`;
			dialogOpts.filters = [
				{ name: 'Dynex Wallet File', extensions: ['dynex'] }
			];
			dialogOpts.buttonLabel = 'OK';
			
			remote.dialog.showSaveDialog(dialogOpts, (file) => {			
				if (file) targetInput.value = file;
				tbtn.classList.remove('d-opened');
			});
		} else if(dialogType === 'serviceFile') {
			dialogOpts.title = `Select directory for your ${targetName}`;
			dialogOpts.filters = [
				{ name: 'Dynex Service File', extensions: ['exe'] }
			];
			dialogOpts.buttonLabel = 'OK';

			remote.dialog.showSaveDialog(dialogOpts, (file) => {			
				if (file) targetInput.value = file;
				tbtn.classList.remove('d-opened');
			});
		} else{
			dialogOpts.properties = [dialogType];
			dialogOpts.filters = [
				{ name: 'Dynex Wallet File', extensions: ['dynex'] }
			];
			remote.dialog.showOpenDialog(dialogOpts, (files) => {
				if (files) targetInput.value = files[0];
				tbtn.classList.remove('d-opened');
			});
		}
	}

	// generic browse path btn event
	for (var i = 0; i < genericBrowseButton.length; i++) {
		let targetInputId = genericBrowseButton[i].dataset.targetinput;
		let args = {
			dialogType: genericBrowseButton[i].dataset.selection,
			targetName: genericBrowseButton[i].dataset.fileobj ? genericBrowseButton[i].dataset.fileobj : '',
			targetInput: document.getElementById(targetInputId),
			targetButton: genericBrowseButton[i].id
		};
		genericBrowseButton[i].addEventListener('click', handleBrowseButton.bind(this, args));
	}

	// generic dialog closer
	wsutil.liveEvent('.dialog-close-default','click', (event) => {
		let el = event.target;
		if(el.dataset.target){
			let tel = document.querySelector(el.dataset.target);
			tel.close();
		}
	});

	var enterHandler;
	function handleFormEnter(el){
		if(enterHandler) clearTimeout(enterHandler);

		let key = this.event.key;
		enterHandler = setTimeout(()=>{
			if(key === 'Enter'){
				let section = el.closest('.section');
				let target = section.querySelector('button:not(.notabindex)');
				if(target) target.dispatchEvent(new Event('click'));
			}
		},400);
	}

	for(var oi=0;oi<genericEnterableInputs.length;oi++){
		let el = genericEnterableInputs[oi];
		el.addEventListener('keyup', handleFormEnter.bind(this, el));
	}

	// toggle view password
	let tp = document.querySelectorAll('.togpass');
	for(var xi=0; xi<tp.length; xi++){
		tp[xi].addEventListener('click', function(e){
			let targetId = e.currentTarget.dataset.pf;
			if(!targetId) return;
			let target = document.getElementById(targetId);
			if(!target) return;
			if(target.type === "password"){
				target.type = 'text';
				e.currentTarget.firstChild.dataset.icon = 'eye-slash';
			}else{
				target.type = 'password';
				e.currentTarget.firstChild.dataset.icon = 'eye';
			}
		});
	}

	// allow paste by mouse
	const pasteMenu = Menu.buildFromTemplate([
		{ label: 'Paste', role: 'paste'}
	]);

	for(var ui=0;ui<genericEditableInputs.length;ui++){
		let el = genericEditableInputs[ui];
		el.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			pasteMenu.popup(remote.getCurrentWindow());
		}, false);
	}

	kswitch.addEventListener('click', showKeyBindings);
	
	lswitch.addEventListener('click', function() {
		lockWallet(false);
	});

	sswitch.addEventListener('click', function() {
		changeSection('section-settings');
	});
	iswitch.addEventListener('click', function() {
		changeSection('section-about');
	});
	cswitch.addEventListener('click', function() {
		overviewWalletCloseButton.dispatchEvent(new Event('click'));
	});

	// settings handlers
	handleSettings();
	// addressbook handlers
	handleAddressBook();
	// open wallet
	handleWalletOpen();
	handleWalletLocked();
	// close wallet
	handleWalletClose();
	// create wallet
	handleWalletCreate();
	// export keys/seed
	handleWalletExport();
	// send transfer
	handleSendTransfer();
	// import keys
	handleWalletImportKeys();
	// import seed
	handleWalletImportSeed();
	// transactions
	handleTransactions();
	// transactions - mempool (by wallet)
	handleMempool();
}

function animateLeft(obj, from, to, cb){
	if(from < to){
		cb()
	} else {
		obj.style.left = from + "px";
		setTimeout(function(){
			animateLeft(obj, from - 1, to, cb);
		}, 7)
	}
}
function animateRight(obj, from, to, cb){
	if(from > to){
		cb()
	} else {
		obj.style.left = from + "px";
		setTimeout(function(){
			animateRight(obj, from + 1, to, cb);
		}, 7)
	}
}

function initKeyBindings(){
	let walletOpened;
	// switch tab: ctrl+tab
	Mousetrap.bind(['ctrl+tab','command+tab'], switchTab);
	Mousetrap.bind(['ctrl+o','command+o'], () => {
		walletOpened = wsession.get('serviceReady') || false;
		if(walletOpened){
			wsutil.showToast(translateString("system_wallet_alreadyopen"));
			return;
		}
		return changeSection('section-overview-load');
	});
	Mousetrap.bind(['ctrl+x','command+x'], () => {
		walletOpened = wsession.get('serviceReady') || false;
		if(!walletOpened){
			wsutil.showToast(translateString("system_wallet_notopened"));
			return;
		}
		overviewWalletCloseButton.dispatchEvent(new Event('click'));
	});
	// display/export private keys: ctrl+e
	Mousetrap.bind(['ctrl+e','command+e'],() => {
		walletOpened = wsession.get('serviceReady') || false;
		if(!walletOpened) return;
		return changeSection('section-overview-show');
	});
	// create new wallet: ctrl+n
	Mousetrap.bind(['ctrl+n','command+n'], ()=> {
		walletOpened = wsession.get('serviceReady') || false;
		if(walletOpened){
			wsutil.showToast(translateString("system_wallet_pleaseclose"));
			return;
		}
		return changeSection('section-overview-create');
	});
	// import from keys: ctrl+i
	Mousetrap.bind(['ctrl+i','command+i'],() => {
		walletOpened = wsession.get('serviceReady') || false;
		if(walletOpened){
			wsutil.showToast(translateString("system_wallet_pleaseclose"));
			return;
		}
		return changeSection('section-overview-import-key');
	});
	// tx page: ctrl+t
	Mousetrap.bind(['ctrl+t','command+t'],() => {
		walletOpened = wsession.get('serviceReady') || false;
		if(!walletOpened){
			wsutil.showToast(translateString("system_wallet_pleaseopen_transactions"));
			return;
		}
		return changeSection('section-transactions');
	});
	// send tx: ctrl+s
	Mousetrap.bind(['ctrl+s','command+s'],() => {
		walletOpened = wsession.get('serviceReady') || false;
		if(!walletOpened){
			wsutil.showToast(translateString("system_wallet_pleaseopen_transfer"));
			return;
		}
		return changeSection('section-send');
	});
	// import from mnemonic seed: ctrl+shift+i
	Mousetrap.bind(['ctrl+shift+i','command+shift+i'], () => {
		walletOpened = wsession.get('serviceReady') || false;
		if(walletOpened){
			wsutil.showToast(translateString("system_wallet_pleaseclose"));
			return;
		}
		return changeSection('section-overview-import-seed');
	});

	// back home
	Mousetrap.bind(['ctrl+home','command+home'], ()=>{
		let section = walletOpened ? 'section-overview' : 'section-welcome';
		return changeSection(section);
	});

	// show key binding
	Mousetrap.bind(['ctrl+/','command+/'], () => {
		let openedDialog = document.querySelector('dialog[open]');
		if(openedDialog) return openedDialog.close();
		return showKeyBindings();
	});

	Mousetrap.bind('esc', () => {
		let openedDialog = document.querySelector('dialog[open]');
		if(!openedDialog) return;
		return openedDialog.close();
	});
}

// spawn event handlers
document.addEventListener('DOMContentLoaded', () => {
	// remove any leftover wallet config
	try { fs.unlinkSync(wsession.get('walletConfig')); } catch (e) { }
	initHandlers();
	showInitialPage();
	initKeyBindings();
}, false);

ipcRenderer.on('cleanup', async () => {
	if(!win.isVisible()) win.show();
	if(win.isMinimized()) win.restore();

	win.focus();

	var dialog = document.getElementById('main-dialog');
	let htmlText = 'Closing Dynex Wallet...';
	if(wsession.get('loadedWalletAddress') !== ''){
		htmlText = 'Saving &amp; Closing Dynex Wallet...';
	}

	let htmlStr = `<div class="div-save-main" style="text-align: center;padding:1rem;"><i class="fas fa-spinner fa-pulse"></i><span style="padding:0px 10px;">${htmlText}</span></div>`;
	dialog.innerHTML = htmlStr;
	dialog.showModal();
	wsmanager.stopSyncWorker();
	wsmanager.stopService().then(() => {
		setTimeout(function(){		
			wsmanager.stopNode().then(() => {
				dialog.innerHTML = 'Goodbye';
				wsmanager.terminateService(true);
				try { fs.unlinkSync(wsession.get('walletConfig')); } catch (e) { }
				win.close();			
			}).catch((err) => {
				log.debug(err);
			});
		}, 1200);
	}).catch((err) => {
		wsmanager.terminateService(true);
		try { fs.unlinkSync(wsession.get('walletConfig')); } catch (e) { }
		win.close();
		log.debug(err);
	});		
});
