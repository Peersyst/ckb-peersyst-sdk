import { ConnectionService, Environments, WalletService, Logger } from "../src";

const ckbUrl = "http://localhost:8117/rpc";
const indexerUrl = "http://localhost:8117/indexer";
const mnemonic = "private pond zero popular fashion pistol";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);
        new WalletService(connectionService, mnemonic);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
