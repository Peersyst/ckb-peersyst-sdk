import { Indexer, RPC } from "@ckb-lumos/lumos";
import { Wallet } from "./wallet";

const ckbUrl = "http://78.46.174.87:8114/rpc";
const indexerUrl = "http://78.46.174.87:8114/indexer";
// const ckbUrl = "https://testnet.ckb.dev/rpc";
// const indexerUrl = "https://testnet.ckb.dev/indexer";

const rpc = new RPC(ckbUrl);
const indexer = new Indexer(indexerUrl, ckbUrl);

// rpc.get_current_epoch().then((epoch) => console.log("epoch:\n", epoch));
rpc.get_blockchain_info().then((info) => console.log("info:\n", info));
rpc.get_block_by_number("0x42a724").then((block) => console.log("block:\n", block));

// Create wallet
const wallet = new Wallet("teach act exotic into script once dutch choice menu elite apple faith");
const address = wallet.getAddress();
console.log(address);
wallet.getBalance(indexer, address).then((value) => console.log(value));
