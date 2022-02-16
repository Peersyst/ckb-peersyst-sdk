import { ConnectionService, Environments } from "./connection.service";
import { WalletService } from "./wallet.service";

const ckbUrl = "http://78.46.174.87:8114/rpc";
const indexerUrl = "http://78.46.174.87:8114/indexer";
// const ckbUrl = "https://testnet.ckb.dev/rpc";
// const indexerUrl = "https://testnet.ckb.dev/indexer";

const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);
connectionService.getBlockchainInfo().then((info) => console.log("info:\n", info));

// Mnemonic: "teach act exotic into script once dutch choice menu elite apple faith"
// Address: ckt1qyq00utuzcymrh3amrp493v99u83yjvu9rkqyjx6w8
// Mnemonic: "private pond zero popular fashion omit february obscure pattern city camp pistol"
// Address: ckt1qyqdlj9dyxgh3gc8lughae8zlemqe5vyzznsnmhy7w

// Import wallet from mnemonic
const mnemonicKey = "teach act exotic into script once dutch choice menu elite apple faith";
const wallet = new WalletService(connectionService, mnemonicKey);
wallet.getBalance().then((value) => console.log(Number(value) / 100000000));
wallet.getTransactions().then((value) => console.log(value.length, JSON.stringify(value, null, 2)));
// Sending 0.5CKB
// wallet.sendTransaction(7500000000, mnemonicKey, "ckt1qyqdlj9dyxgh3gc8lughae8zlemqe5vyzznsnmhy7w").then((txHash) => console.log(txHash));
