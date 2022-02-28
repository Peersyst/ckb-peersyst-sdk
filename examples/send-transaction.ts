import { ConnectionService, Environments, WalletService, Logger } from "../src";

const ckbUrl = "http://78.46.174.87:8114/rpc";
const indexerUrl = "http://78.46.174.87:8114/indexer";
const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";
const receivingAddress = "ckt1qyq00utuzcymrh3amrp493v99u83yjvu9rkqyjx6w8";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);

        // Wallet instance is necessary for all wallet functions
        const wallet = new WalletService(connectionService, mnemonic);

        const amount = BigInt(123 * 10 ** 8); // 123 CKB
        const txHash = await wallet.sendTransaction(amount, mnemonic, receivingAddress);
        Logger.info(txHash);

        // You can view newly generated transaction through wallet.getTransactions
        // If you want to know transaction status
        const transaction = await connectionService.getTransactionFromHash(txHash);
        Logger.info(JSON.stringify(transaction, null, 2));
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
