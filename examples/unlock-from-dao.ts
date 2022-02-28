import { ConnectionService, Environments, WalletService, Logger } from "../src";

const ckbUrl = "http://78.46.174.87:8114/rpc";
const indexerUrl = "http://78.46.174.87:8114/indexer";
const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);

        // Wallet instance is necessary for all wallet functions
        const wallet = new WalletService(connectionService, mnemonic);

        // We will try to unlock first unlockable amount
        const unlockableAmounts = await wallet.getDAOUnlockableAmounts();
        if (unlockableAmounts.length === 0) {
            throw new Error("No unlockable amount. Deposit before trying to withdraw");
        }

        const unlockHash = await wallet.withdrawAndUnlock(unlockableAmounts[1], mnemonic);
        Logger.info(unlockHash);

        // You can view DAO balance with
        const daoBalance = await wallet.getDAOBalance();
        Logger.info(daoBalance);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
