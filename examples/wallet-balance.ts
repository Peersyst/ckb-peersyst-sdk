import { ConnectionService, Environments, WalletService, Logger } from "../src";

const ckbUrl = "http://78.46.174.87:8114/rpc";
const indexerUrl = "http://78.46.174.87:8114/indexer";
const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";

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
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
