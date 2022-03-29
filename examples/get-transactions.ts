import { ConnectionService, Environments, WalletService, Logger } from "../src";

const ckbUrl = "http://78.46.174.87:8114/rpc";
const indexerUrl = "http://78.46.174.87:8114/indexer";
// const mnemonic2 = "teach act exotic into script once dutch choice menu elite apple faith";
const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);

        // Wallet instance is necessary for all wallet functions
        const wallet = new WalletService(connectionService, mnemonic);
        await wallet.synchronize();

        const transactions = await wallet.getTransactions();
        Logger.info(transactions);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
        Logger.error(`${error.stack}`);
    }
};

main();
