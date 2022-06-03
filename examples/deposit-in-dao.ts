import { ConnectionService, Environments, WalletService, Logger } from "../src";

const ckbUrl = "http://localhost:8117/rpc";
const indexerUrl = "http://localhost:8117/indexer";
const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";
const amount = BigInt(500 * 10 ** 8);

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);
        const wallet = new WalletService(connectionService, mnemonic);

        const txHash = await wallet.depositInDAO(amount, mnemonic);
        Logger.info(txHash);

        // You can view DAO balance with
        const daoBalance = await wallet.getDAOBalance();
        Logger.info(daoBalance);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
