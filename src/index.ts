import { ConnectionService, Environments } from "./connection.service";
import { WalletService } from "./wallet.service";

const ckbUrl = "http://78.46.174.87:8114/rpc";
const indexerUrl = "http://78.46.174.87:8114/indexer";
// const ckbUrl = "https://testnet.ckb.dev/rpc";
// const indexerUrl = "https://testnet.ckb.dev/indexer";

const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);
connectionService.getBlockchainInfo().then((info) => console.log("info:\n", info));

// Import wallet from mnemonic
const wallet = new WalletService(connectionService, "teach act exotic into script once dutch choice menu elite apple faith");
const address = wallet.getAddress();
console.log(address);
wallet.getBalance().then((value) => console.log(value));
wallet.getTransactions().then((value) => console.log(JSON.stringify(value, null, 2)));
