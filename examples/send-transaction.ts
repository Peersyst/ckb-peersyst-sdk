import { ConnectionService, Environments, WalletService, Logger, FeeRate } from "../src";

// const ckbUrl = "http://78.46.174.87:8114/rpc";
// const indexerUrl = "http://78.46.174.87:8114/indexer";
const ckbUrl = "https://testnet.ckb.dev/rpc";
const indexerUrl = "https://testnet.ckb.dev/indexer";
// const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";
const mnemonic = "teach act exotic into script once dutch choice menu elite apple faith";
// const receivingAddress = "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqflx85grt0mnny6qsqwfxwkkvud4x3gwqgq2d0su";
const receivingAddress = "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqgkgzwqv9v9sxyzc83wkaqnsvl9tnqulnc96zxp3";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);

        // Wallet instance is necessary for all wallet functions
        const wallet = new WalletService(connectionService, mnemonic);

        const amount = BigInt(68 * 10 ** 8); // 10250 CKB
        const txHash = await wallet.sendTransaction(amount, mnemonic, receivingAddress, FeeRate.NORMAL);
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
