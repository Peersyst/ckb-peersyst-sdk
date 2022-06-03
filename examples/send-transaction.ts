import { ConnectionService, Environments, WalletService, Logger, FeeRate } from "../src";

const ckbUrl = "http://localhost:8117/rpc";
const indexerUrl = "http://localhost:8117/indexer";
const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";
const receivingAddress = "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqflx85grt0mnny6qsqwfxwkkvud4x3gwqgq2d0su";
const amount = BigInt(513 * 10 ** 8); // 513 CKB

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);
        const wallet = new WalletService(connectionService, mnemonic);

        // No need to sync as sendTransactions syncs before building the transaction
        const txHash = await wallet.sendTransaction(amount, mnemonic, receivingAddress, FeeRate.NORMAL);
        Logger.info(txHash);

        // You can view newly generated transaction through wallet.getTransactions when the tx is committed
        // If you want to know transaction status
        const transaction = await connectionService.getTransactionFromHash(txHash);
        Logger.info(JSON.stringify(transaction, null, 2));
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
