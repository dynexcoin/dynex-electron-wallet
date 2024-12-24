var config = {};

// Application name, descriptions, etc
config.appName = 'Dynex-Electron-Wallet';
config.appDescription = 'Dynex Electron Wallet';
config.appSlogan = 'DNX - The Quantum Currency';
config.appId = 'dynex-electron-wallet';
config.appWebsite = 'https://dynexcoin.org/';
config.appGitRepo = 'https://github.com/dynexcoin/dynex-electron-wallet';

// default port number for your daemon (e.g. dynexd)
config.daemonDefaultRpcPort = 18333;

// wallet file created by this app will have this extension
config.walletFileDefaultExt = 'dynex';

// change this to match your wallet service executable filename
config.walletNodeBinaryFilename = 'DNX-node';
config.walletServiceBinaryFilename = 'DNX-service';

// version of the wallet
config.electronVersion = "3.1.1";
config.walletVersion = "1.0.0";
// version on the bundled service (DNX-service)
config.walletServiceBinaryVersion = "2.2.2-20231220";
// version on the bundled service (DNX-node)
config.walletServiceNodeVersion = "2.2.2-20231220";

// default port number for your wallet service (e.g. DNX-service)
config.walletServiceRpcPort = 8070;

// block explorer url, the [[TX_HASH] will be substituted w/ actual transaction hash
config.blockExplorerTransactionUrl = 'https://blockexplorer.dynexcoin.org/tx/[[TX_HASH]]';

// default remote node to connect to, set this to a known reliable node for 'just works' user experience
config.remoteNodeDefaultHost = '127.0.0.1';
// fallback remote node list, in case fetching update failed, fill this with known to works remote nodes
config.remoteNodeListFallback = [
	'127.0.0.l:18333'
];
// Currency name
config.assetName = 'Dynex';
// Currency ticker
config.assetTicker =  'DNX';
// Currency address prefix, for address validation
config.addressPrefix =  'X';
// Standard wallet address length, for address validation
config.addressLength = 96;
// Minimum fee for sending transaction
config.minimumFee = 0.001;
// Minimum amount for sending transactionconfig.mininumSend = 0.000001;
// to convert from atomic unit
config.decimalDivisor = 1000000000;
// Decimal Places
config.decimalPlaces = 9;
// Key to encrypt your address book
config.addressBookObfuscationKey = '79829ea01ca1b7130833a42de45142bf6c4b7f423fe6fba5';
// Export the Configuration to the Application
module.exports = config;