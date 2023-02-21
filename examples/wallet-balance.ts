import { AddressType } from "@ckb-lumos/hd";
import { ConnectionService, Environments, WalletService, Logger } from "../src";

// const ckbUrl = "http://78.46.174.87:8114/rpc";
// const indexerUrl = "http://78.46.174.87:8114/indexer";
// const ckbUrl = "http://ckb-node-test-1.peersyst.com/rpc";
// const indexerUrl = "http://ckb-node-test-1.peersyst.com/indexer";
const ckbUrl = "https://testnet.ckb.dev/rpc";
const indexerUrl = "https://testnet.ckb.dev/indexer";
// const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";
const mnemonic = "teach act exotic into script once dutch choice menu elite apple faith";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);

        // Wallet instance is necessary for all wallet functions
        const wallet = new WalletService(connectionService, mnemonic);
        await wallet.synchronize();

        const balanceAcc0 = await wallet.getBalanceFromAccount(0);
        Logger.info(balanceAcc0);
        const balanceAcc1 = await wallet.getBalanceFromAccount(1);
        Logger.info(balanceAcc1);
        const totalBalance = await wallet.getBalance();
        Logger.info(totalBalance);
        const tokensBalance = await wallet.getTokensBalance();
        Logger.info(tokensBalance);
        const nftBalance = await wallet.getNftsBalance();
        Logger.info(nftBalance);
        const addresses = wallet.getAllAddresses();
        Logger.info(addresses);
        const address2 = wallet.getAddress(2, AddressType.Receiving);
        Logger.info(address2);
        const address3 = wallet.getAddress(3, AddressType.Receiving);
        Logger.info(address3);
        const header = await connectionService.getCurrentBlockHeader();
        Logger.info(header);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
