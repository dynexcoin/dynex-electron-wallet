var config = {};

// self explanatory, your application name, descriptions, etc
config.appName = 'Dynex-Electron-Wallet';
config.appDescription = 'Dynex Electron Wallet';
config.appSlogan = 'DNX - The Quantum Currency';
config.appId = 'dynex-electron-wallet';
config.appWebsite = 'https://dynexcoin.org/';
config.appGitRepo = 'https://github.com/dynexcoin/';

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

// remote node list update url, set to null if you don't have one
config.remoteNodeListUpdateUrl = null;

// fallback remote node list, in case fetching update failed, fill this with known to works remote nodes
config.remoteNodeListFallback = [
	'127.0.0.l:18333'
];

// your currency name
config.assetName = 'Dynex';
// your currency ticker
config.assetTicker =  'DNX';
// your currency address prefix, for address validation
config.addressPrefix =  'X';
// standard wallet address length, for address validation
config.addressLength = 96;
// intergrated wallet address length, for address validation
config.integratedAddressLength = 96;

// minimum fee for sending transaction
config.minimumFee = 0.001;
// minimum amount for sending transaction
config.mininumSend = 0.000001;
// to convert from atomic unit
config.decimalDivisor = 1000000000;
// to represent human readable value
config.decimalPlaces = 9;

// obfuscate address book entries, set to false if you want to save it in plain json file.
// not for security because the encryption key is attached here
config.addressBookObfuscateEntries = true;
// key use to obfuscate address book contents
config.addressBookObfuscationKey = '79829ea01ca1b7130833a42de45142bf6c4b7f423fe6fba5';
// initial/sample entries to fill new address book
config.addressBookSampleEntries = [
	{
		name: 'Y3TI',
		address: 'XwnxYjKQ4LHgXnwXZsj8EQU72xqkAcj9B3CAniS3Ts8BbDxszcxnsHvXg9EX8bnaYdiQ5VBvfRYhbaaBiU9xxtix2K1mRtukG',
		paymentId: '',
	}
];

// Dynex Website
config.blockMoneyUrl = 'https://dynexcoin.org/';

// Dynex download url
config.blockMoneyDownloadUrl = 'https://dynexcoin.org/';

// Block explorer url
config.blockExplorerUrl = 'https://blockexplorer.dynexcoin.org/';

// Discord channel url
config.discordChannelUrl = '';

// Telegram channel url
config.telegramChannelUrl = '';

// Github page url
config.githubPageUrl = '';

// Twitter profile url
config.twitterProfileUrl = '';

// Reddit forum url
config.redditProfileUrl = '';

// Medium profile url
config.mediumProfileUrl = '';

// Youtube channel url
config.youtubeChannelUrl = '';

// Facebook page url
config.facebookPageUrl = '';

module.exports = config;