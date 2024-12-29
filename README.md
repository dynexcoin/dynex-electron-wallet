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
* ✅ Dutch - MJ & karim
* ✅ French - pasteyy (PENDING)
* ✅ Greek - nostalgia
* ✅ German - sumitomo
* ✅ Italian - piciluc8571
* Japanese 
* ✅ Polish - rlyfastessa
* Portuguese 
* ✅ Russian - Отец Сергий
* ✅ Spanish - ismoyano
* ✅ Swedish - maximilian
* ✅ Turkish - giants0808 (PENDING)

### Verified Supported Operating Systems
* ✅ Windows (10 / 11)
* Linux
* MAC
* Android
* iOS

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
You need to have `Node.js` and `npm` installed, go to https://nodejs.org and find out how to get it installed on your platform.

Once you have Node+npm installed:
```
# clone the repo
$ git clone https://github.com/dynexcoin/dynex-electron-wallet
$ cd Dynex-electron-wallet

# install dependencies
$ npm install

# create build+dist directory
$ mkdir -p ./build && mkdir -p ./dist

# copy/symlink icons from assets, required for packaging
$ cp ./src/assets/icon.* ./build/

# build GNU/Linux package
$ mkdir -p ./bin/lin
$ cp /path/to/linux-version-of/DNX-service ./bin/lin/
$ npm run dist-lin

# build Windows package
$ mkdir -p ./bin/win
$ cp /path/to/win-version-of/DNX-service.exe ./bin/win/
$ [LINUX] npm run dist-win (running from linux)
$ [WIN] node_modules\.bin\electron-builder --x64 --win -c.extraResources=dnx\DNX-service.exe -c.extraResources=dnx\DNX-node.exe -c.extraResources=dnx\libcurl.dll -c.extraResources=dnx\zlib1.dll -c.extraResources=lang\en.json  -c.extraResources=lang\en.json -c.extraResources=lang\cn.json -c.extraResources=lang\de.json -c.extraResources=lang\es.json -c.extraResources=lang\gr.json -c.extraResources=lang\nerd.json -c.extraResources=lang\nerd.md -c.extraResources=lang\nl.json -c.extraResources=lang\pirate.json -c.extraResources=lang\pl.json -c.extraResources=lang\ru.json -c.extraResources=lang\se.json

# build OSX package
$ mkdir -p ./bin/osx
$ cp /path/to/osx-version-of/DNX-service ./bin/osx/
$ npm run dist-mac
```

Resulting packages or installer can be found inside `dist/` directory.