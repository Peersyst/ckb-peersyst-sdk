import { ConnectionService, Environments } from "./connection.service";
import { WalletService } from "./wallet.service";

const ckbUrl = "http://78.46.174.87:8114/rpc";
const indexerUrl = "http://78.46.174.87:8114/indexer";

const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);
// connectionService.getBlockchainInfo().then((info) => console.log("info:\n", info));

const mnemonicKeyAcc1 = "teach act exotic into script once dutch choice menu elite apple faith";
// const addresAcc1 =  "ckt1qyq00utuzcymrh3amrp493v99u83yjvu9rkqyjx6w8";
// const mnemonicKeyAcc2 = "private pond zero popular fashion omit february obscure pattern city camp pistol";
// const addressAcc2 = "ckt1qyqdlj9dyxgh3gc8lughae8zlemqe5vyzznsnmhy7w";

// Import wallet from mnemonic
const wallet = new WalletService(connectionService, mnemonicKeyAcc1);
wallet.getBalance().then((value) => console.log(Number(value) / 10 ** 8));
wallet.getTokensBalance().then((tokens) => console.log(tokens));
wallet.getTransactions().then((value) => console.log(value.length, JSON.stringify(value, null, 2)));

// Send 123CKB
// wallet.sendTransaction(BigInt(123 * 10 ** 8), mnemonicKeyAcc1, addressAcc2).then((txHash) => console.log(txHash));

// Issue sudt token
// wallet.issueTokens(100, mnemonicKeyAcc1).then((txHash) => console.log(txHash));

// Transfer sudt token
// const token = "0x099472fc82e74d050d524ba32f8efc05d4a53800f4ab0bf88be9c3383586339a";
// wallet.transferTokens(10, mnemonicKeyAcc1, addressAcc2, token).then((txHash) => console.log(txHash));
