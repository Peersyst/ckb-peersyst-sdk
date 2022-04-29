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
        const currentlyUnlockableAmounts = unlockableAmounts.filter((ua) => ua.unlockable || ua.type === "deposit");
        if (currentlyUnlockableAmounts.length === 0) {
            throw new Error("No unlockable or withdrawable amount. Deposit before trying to withdraw");
        }

        Logger.info("Unlocking the following unlockable amount:");
        Logger.info(currentlyUnlockableAmounts[0]);
        const unlockHash = await wallet.withdrawOrUnlock(currentlyUnlockableAmounts[0], mnemonic);
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
