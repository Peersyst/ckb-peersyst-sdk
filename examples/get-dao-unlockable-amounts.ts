import { ConnectionService, Environments, WalletService, Logger } from "../src";

const ckbUrl = "http://localhost:8117/rpc";
const indexerUrl = "http://localhost:8117/indexer";
const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);
        const wallet = new WalletService(connectionService, mnemonic);
        await wallet.synchronize();

        const unlockableAmounts = await wallet.getDAOUnlockableAmounts();
        Logger.info(unlockableAmounts);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
