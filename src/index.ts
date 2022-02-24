import { ConnectionService, Environments } from "./connection.service";
import { WalletService } from "./wallet.service";

const ckbUrl = "http://78.46.174.87:8114/rpc";
const indexerUrl = "http://78.46.174.87:8114/indexer";

const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);
// connectionService.getBlockchainInfo().then((info) => console.log("info:\n", info));

// const mnemonicKeyAcc1 = "teach act exotic into script once dutch choice menu elite apple faith";
// const addressAcc1 = "ckt1qyq00utuzcymrh3amrp493v99u83yjvu9rkqyjx6w8";
const mnemonicKeyAcc2 = "private pond zero popular fashion omit february obscure pattern city camp pistol";
// const addressAcc2 = "ckt1qyqdlj9dyxgh3gc8lughae8zlemqe5vyzznsnmhy7w";
// const daoAddress = "ckt1qjpdwmgmwhlzlkdz0ha65edq8y3p5wqdwmyjdumc60upeul8uyljah7g45sez79rqll3zlhyutl8vrx3ssg2wmag75a";

// Import wallet from mnemonic
const wallet = new WalletService(connectionService, mnemonicKeyAcc2);
wallet.getBalance().then((value) => console.log((Number(value) / 10 ** 8).toFixed(8)));
// wallet.getTokensBalance().then((tokens) => console.log(tokens));
// wallet.getTransactions().then((value) => console.log(value.length, JSON.stringify(value, null, 2)));

// Send 123CKB
// wallet.sendTransaction(BigInt(123 * 10 ** 8), mnemonicKeyAcc1, addressAcc2).then((txHash) => console.log(txHash));

// SUDT token functions
// wallet.issueTokens(100, mnemonicKeyAcc1).then((txHash) => console.log(txHash));
// const token = "0x099472fc82e74d050d524ba32f8efc05d4a53800f4ab0bf88be9c3383586339a";
// wallet.transferTokens(10, mnemonicKeyAcc1, addressAcc2, token).then((txHash) => console.log(txHash));

// DAO functions
// wallet.depositInDAO(BigInt(150 * 10 ** 8), mnemonicKeyAcc2, daoAddress).then((txHash) => console.log(txHash));
// wallet.getDAOCells(daoAddress).then((cells) => {
//     console.log(cells);
//     wallet.withdrawFromDAO(cells[0], mnemonicKeyAcc2).then((txHash) => console.log(txHash));
// });

wallet.getDAOStatistics().then((statistics) => console.log(statistics));
