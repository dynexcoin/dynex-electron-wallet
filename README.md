# Dynex Electron Wallet

[Dynex Electron GUI Wallet](https://dynexcoin.org) - GUI Stands for Graphical User Interface. It makes it easy for you to use Dynex with a friendly user interface. The Dynex Electron Wallet client allows you to create your wallet, store and send your DNX, view your transactions, stay connected with the Dynex ecosystem.

## Features:
This wallet contains the basic functions required to manage your Dynex (DNX):

* Wallet Creation
  * Create new wallet
  * Import from private keys OR mnemonic seed
* Basic Wallet Operation
  * Open an existing wallet
  * Display wallet address & balance
  * Display private keys/seed
  * Export private keys/seed
  * Transactions listing/sorting/searching
  * Display transaction details
  * Export incoming, outgoing, or all transactions to csv file.
  * Incoming Transaction notification
  * Send DNX to single recipient address, allow to set payment id and custom fee. Provides address lookup from addressbook.
  * Perform wallet optimization by creating fusion transactions
* Address Book
  * Add/Edit/Delete address entry (label/name, address and payment id)
  * Listing/sorting/searching existing entries
  * Allow to store same wallet address with different payment id
  * Autosave address after sending to new/unknown recipient
* Backup  
  * Backup your wallet with your private keys so you can restore your wallet anytime
* Misc
  * Provides internal node and wallet services
  * Keyboard shortcuts for ease of use
  * Multi language system (supporting 10+ languages)
* Dynex Ecosystem Tools 
  * DHIP (Opt in for Native L1 Chain)
  * Bridge (Ability to bridge L1 DNX to L2 0xDNX)
  * QNODES (Ability to monitor Dynex Quantum Nodes)

### Languages
* ✅ English (Default)
* ✅ Chinese - flugel
* ✅ Dutch - MJ
* French
* ✅ Greek - nostalgia
* ✅ German - sumitomo
* ✅ Italian - piciluc8571
* Japanese 
* ✅ Polish - rlyfastessa
* Portuguese 
* ✅ Russian - Отец Сергий
* ✅ Spanish - ismoyano
* ✅ Swedish - maximilian
* Turkish

### Verified Supported Operating Systems
* Windows
  * ✅ Windows 10
  * ✅ Windows 11
* Linux
  * ✅ Ubuntu 22.04 LTS
* MAC
  * 14
  * 15
* Android
  * Android 13
  * Android 14
  * Android 15
* iOS
  * 16
  * 17
  * 18

### Notes
Dynex Electron Wallet relies on `DNX-service` and `DNX-node` to manage wallet container &amp; rpc communication.
Release installer & packaged archives includes a ready to use `DNX-service` and `DNX-node` binaries, which is unmodified copy DNX official wallet release github.

On first launch, Dynex Electron Wallet will try to detect location/path of bundled `DNX-service` and `DNX-node` binaries, but if autodetection failed, you can manually set path to the `DNX-service` and `DNX-node` binaries on the Settings screen.

If you don't trust the bundled `DNX-service` and `DNX-node` binariy files, you can compare the checksum (sha256sum) against one from the official release, or simply download and use the binaries from official DNX release, which is available here: https://github.com/dynexcoin/Dynex/releases. Then, update your `DNX-service` and `DNX-node` binariy path settings.

## **Lanch the app**

#### Windows:

1. Download the latest installer [here](https://github.com/dynexcoin/dynex-electron-wallet/releases)
2. Run the installer (Dynex-Electron-Wallet-<version>-win-setup.exe) and follow the installation wizard.
3. Run as Administrator Dynex-Electron-Wallet via start menu or desktop shortcut. (right click on the app icon and select run as Administrator)

#### GNU/Linux (AppImage):

1. Download latest AppImage bundle [here](https://github.com/dynexcoin/dynex-electron-wallet/releases)
2. Make it executable, either via GUI file manager or command line, e.g. `chmod +x Dynex-Electron-Wallet-<version>-linux.AppImage`
3. Run/execute the file, double click in file manager, or run via shell/command line.

See: https://docs.appimage.org/user-guide/run-appimages.html

#### macOS

1. Download latest archive [here](https://github.com/dynexcoin/dynex-electron-wallet/releases)
2. Extract downloaded zip archived into your home folder
3. Open terminal and Run: `cd /Users/YOURNAME/Dynex-Electron-Wallet.app/Contents/MacOS && ./Dynex-Electron-Wallet`

### Build From Source

Building the Dynex Electron Wallet from source requires `Node.js` and `npm`. Follow the steps below to get started:

#### Prerequisites
1. **Install Node.js and npm**:  
   Visit [Node.js official website](https://nodejs.org) to download and install the latest stable version of Node.js (ensure the version is 21.0 or later).

2. **Clone the Repository**:  
   Clone the wallet's source code repository to your local machine.
   ```bash
   # Clone the repository
   git clone https://github.com/dynexcoin/dynex-electron-wallet
   cd dynex-electron-wallet
   ```

3. **Install Dependencies**:  
   Run the following command to install all necessary dependencies.
   ```bash
   npm install
   ```

#### Building the Wallet

##### For Linux
To build the wallet as an AppImage for Linux:
```bash
node_modules/.bin/electron-builder --x64 --linux AppImage \
  --config.extraResources=dnx/DNX-service \
  --config.extraResources=dnx/DNX-node \
  --config.extraResources=dnx/libcurl.so.4 \
  --config.extraResources=dnx/libboost_filesystem.so.1.74.0 \
  --config.extraResources=dnx/libboost_program_options.so.1.74.0 \
  --config.extraResources=dnx/libz.so.1 \
  --config.extraResources=lang/en.json \
  --config.extraResources=lang/cn.json \
  --config.extraResources=lang/de.json \
  --config.extraResources=lang/es.json \
  --config.extraResources=lang/gr.json \
  --config.extraResources=lang/nerd.json \
  --config.extraResources=lang/nerd.md \
  --config.extraResources=lang/nl.json \
  --config.extraResources=lang/pirate.json \
  --config.extraResources=lang/pl.json \
  --config.extraResources=lang/ru.json \
  --config.extraResources=lang/se.json \
  --config.extraResources=lang/it.json \
  --config.extraFiles=postinstall.sh
```

##### For Windows
To build the wallet for Windows, open a Command Prompt as Administrator and run:
```bash
node_modules\.bin\electron-builder.cmd --x64 --win \
  --config.extraResources=dnx/DNX-service.exe \
  --config.extraResources=dnx/DNX-node.exe \
  --config.extraResources=dnx/libcurl.dll \
  --config.extraResources=dnx/zlib1.dll \
  --config.extraResources=lang/en.json \
  --config.extraResources=lang/cn.json \
  --config.extraResources=lang/de.json \
  --config.extraResources=lang/es.json \
  --config.extraResources=lang/gr.json \
  --config.extraResources=lang/nerd.json \
  --config.extraResources=lang/nerd.md \
  --config.extraResources=lang/nl.json \
  --config.extraResources=lang/pirate.json \
  --config.extraResources=lang/pl.json \
  --config.extraResources=lang/ru.json \
  --config.extraResources=lang/se.json \
  --config.extraResources=lang/it.json
```

##### For macOS
To build the wallet for macOS, replace that files in the `resources` and `dnx` with the files in the `mac` folder, then run:
```bash
node_modules/.bin/electron-builder --x64 --mac \
 --config.extraResources=dnx/DNX-service \
 --config.extraResources=dnx/DNX-node \
 --config.extraResources=dnx/libBlockchainExplorer.a \
 --config.extraResources=dnx/libCommon.a \
 --config.extraResources=dnx/libCrypto.a \
 --config.extraResources=dnx/libDynexCNCore.a \
 --config.extraResources=dnx/libHttp.a \
 --config.extraResources=dnx/libInProcessNode.a \
 --config.extraResources=dnx/libJsonRpcServer.a \
 --config.extraResources=dnx/libLogging.a \
 --config.extraResources=dnx/libMnemonics.a \
 --config.extraResources=dnx/libNodeRpcProxy.a \
 --config.extraResources=dnx/libP2P.a \
 --config.extraResources=dnx/libPaymentGate.a \
 --config.extraResources=dnx/libRpc.a \
 --config.extraResources=dnx/libSerialization.a \
 --config.extraResources=dnx/libSystem.a \
 --config.extraResources=dnx/libTransfers.a \
 --config.extraResources=dnx/libWallet.a \
 --config.extraResources=lang/en.json \
 --config.extraResources=lang/cn.json \
 --config.extraResources=lang/de.json \
 --config.extraResources=lang/es.json \
 --config.extraResources=lang/gr.json \
 --config.extraResources=lang/nerd.json \
 --config.extraResources=lang/nerd.md \
 --config.extraResources=lang/nl.json \
 --config.extraResources=lang/pirate.json \
 --config.extraResources=lang/pl.json \
 --config.extraResources=lang/ru.json \
 --config.extraResources=lang/se.json \
 --config.extraResources=lang/it.json \
 --config.extraFiles=postinstall.sh
```

And that's it! Once the build process completes, you’ll find the output files in the `dist` directory. You can then distribute or use the built wallet application.

