import { ConnectionService, Environments } from "./connection.service";
import { WalletService } from "./wallet.service";

const ckbUrl = "http://78.46.174.87:8114/rpc";
const indexerUrl = "http://78.46.174.87:8114/indexer";

const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);
connectionService.getBlockchainInfo().then((info) => console.log("info:\n", info));

const mnemonicKeyAcc1 = "teach act exotic into script once dutch choice menu elite apple faith";
// const addresAcc1 =  "ckt1qyq00utuzcymrh3amrp493v99u83yjvu9rkqyjx6w8";
// const mnemonicKeyAcc2 = "private pond zero popular fashion omit february obscure pattern city camp pistol";
// const addressAcc2 = "ckt1qyqdlj9dyxgh3gc8lughae8zlemqe5vyzznsnmhy7w";

// Import wallet from mnemonic
const wallet = new WalletService(connectionService, mnemonicKeyAcc1);
wallet.getBalance().then((value) => console.log(Number(value) / 10 ** 8));
// wallet.getTransactions().then((value) => console.log(value.length, JSON.stringify(value, null, 2)));

// Send 150CKB
// wallet.sendTransaction(BigInt(150 * 10 ** 8), mnemonicKeyAcc1, addressAcc2).then((txHash) => console.log(txHash));

// Issue usdt token
wallet.issueTokens(1, mnemonicKeyAcc1).then((txHash) => console.log(txHash));
