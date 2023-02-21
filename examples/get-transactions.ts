import { ConnectionService, Environments, WalletService, Logger } from "../src";

// const ckbUrl = "http://78.46.174.87:8114/rpc";
// const indexerUrl = "http://78.46.174.87:8114/indexer";
const ckbUrl = "http://ckb-node-mainnet.peersyst.com/rpc";
const indexerUrl = "http://ckb-node-mainnet.peersyst.com/indexer";
const mnemonic = "teach act exotic into script once dutch choice menu elite apple faith";
// const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Mainnet);

        // Wallet instance is necessary for all wallet functions
        const wallet = new WalletService(connectionService, mnemonic);
        await wallet.synchronize();

        // const transactions = wallet.getTransactions();
        // Logger.info(transactions);
        // Logger.info(transactions.length);
        // const transactions = await wallet.getTransactionsFromAccount();
        // Logger.info(transactions);
        // Logger.info(transactions.length);
        const totalBalance = await wallet.getBalanceFromAccount();
        Logger.info(totalBalance);
        Logger.info(totalBalance.nfts[0]);
        // const addresses = wallet.getAllAddresses();
        // Logger.info(addresses);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
        Logger.error(`${error.stack}`);
    }
};

main();
