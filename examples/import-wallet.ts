import { ConnectionService, Environments, WalletService, Logger, WalletState } from "../src";

const ckbUrl = "http://78.46.174.87:8114/rpc";
const indexerUrl = "http://78.46.174.87:8114/indexer";
const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);

        // Wallet instance is necessary for all wallet functions
        const wallet = new WalletService(connectionService, mnemonic, null, async (walletState: WalletState) => {
            Logger.info("Got wallet State:");
            Logger.info(walletState);
        });

        await wallet.synchronize();
        const accounts = wallet.getAccountIndexes();
        Logger.info(accounts);
        const addresses = wallet.getAllAddresses();
        Logger.info(addresses);
        const newAddress = wallet.getNewAddress();
        Logger.info(newAddress);
        Logger.info(connectionService.isAddress(newAddress));
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
