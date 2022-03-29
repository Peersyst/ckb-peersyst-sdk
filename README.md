# Description

Peersyst typescrypt sdk to connect with nervos network

## Examples

In the folder example you can find examples on how to use the sdk.

To run any example use:
```
npm run example --name=wallet-balance
```

Where _wallet-balance_ can be any other example file name (import-wallet, create-wallet, get-transactions...)

## Installation
- To install the package with yarn use:
```
yarn add git+https://github.com/Peersyst/ckb-peersyst-sdk#1.0.0
```
- To install the package with npm use:
```
npm install --save git+https://github.com/Peersyst/ckb-peersyst-sdk#1.0.0
```
You can change the version changing what comes after #

## Usage
1. Instantiate connection service:
```typescrypt
import { ConnectionService, Environments, WalletService, Logger } from "@peersyst/ckb-peersyst-sdk";

const ckbUrl = "YourMainNodeRpcUrl";
const indexerUrl = "YourMainNodeIndexerUrl";
const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Mainnet);
```
2. Instantiate wallet service:
```typescrypt
// To create mnemonic if you do not have one:
const mnemonic = WalletService.createNewMnemonic();
const wallet = new WalletService(connectionService, mnemonic);
```
3. Refresh wallet data:
```typescrypt
await wallet.synchronize();
```
4. Make any call from the wallet:
```typescrypt
const totalBalance = await wallet.getBalance();
Logger.info(totalBalance);

const amount = BigInt(500 * 10 ** 8);
const txHash = await wallet.depositInDAO(amount, mnemonic);
```