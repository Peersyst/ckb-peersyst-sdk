import { ConnectionService, Environments, WalletService, Logger } from "../src";

const ckbUrl = "http://localhost:8117/rpc";
const indexerUrl = "http://localhost:8117/indexer";
const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);
        const wallet = new WalletService(connectionService, mnemonic);

        // We will try to unlock first unlockable amount
        const unlockableAmounts = await wallet.getDAOUnlockableAmounts();
        if (unlockableAmounts.length === 0) {
            throw new Error("No unlockable or withdrawable amount. Deposit before trying to withdraw");
        }

        Logger.info("Withdrawing or unlocking the following unlockable amount:");
        Logger.info(unlockableAmounts[0]);
        const unlockHash = await wallet.withdrawOrUnlock(unlockableAmounts[0], mnemonic);
        Logger.info(unlockHash);

        // You can view DAO balance with
        const daoBalance = await wallet.getDAOBalance();
        Logger.info(daoBalance);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
        Logger.error(`${error.stack}`);
    }
};

main();
