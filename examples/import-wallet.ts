import { ConnectionService, Environments, WalletService, Logger, WalletState } from "../src";

const ckbUrl = "http://localhost:8117/rpc";
const indexerUrl = "http://localhost:8117/indexer";
const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);

        // The third parameter given in the constructor is a callback called when a synchronize finishes
        const wallet = new WalletService(connectionService, mnemonic, null, async (walletState: WalletState) => {
            Logger.info("Got wallet State:");
            Logger.info(walletState);
        });

        await wallet.synchronize();
        const accounts = wallet.getAccountIndexes();
        Logger.info(accounts);
        const addresses = wallet.getAllAddresses();
        Logger.info(addresses);
        const newAddress = wallet.getNextAddress();
        Logger.info(newAddress);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
