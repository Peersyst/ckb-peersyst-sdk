import { RPC } from "@ckb-lumos/rpc";

const uri = "http://78.46.174.87:8114/rpc";
// const indexer = "http://78.46.174.87:8114/indexer";
const rpc = new RPC(uri);
rpc.get_block_by_number("0x100").then((block) => console.log("block:\n", block));
rpc.get_current_epoch().then((epoch) => console.log("epoch:\n", epoch));
rpc.get_blockchain_info().then((info) => console.log("info:\n", info));
