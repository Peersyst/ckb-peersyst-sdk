import { ConnectionService, Environments, WalletService, Logger } from "../src";

// const ckbUrl = "http://78.46.174.87:8114/rpc";
// const indexerUrl = "http://78.46.174.87:8114/indexer";
const ckbUrl = "https://testnet.ckb.dev/rpc";
const indexerUrl = "https://testnet.ckb.dev/indexer";
const mnemonic = "teach act exotic into script once dutch choice menu elite apple faith";
// const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);

        // Wallet instance is necessary for all wallet functions
        const wallet = new WalletService(connectionService, mnemonic);
        await wallet.synchronize();

        const transactions = wallet.getTransactions();
        Logger.info(transactions.map((tx) => tx.type));
        Logger.info(transactions.length);
        const address = "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqgkgzwqv9v9sxyzc83wkaqnsvl9tnqulnc96zxp3";
        const addressTransactions = await wallet.getTransactionsFromAddress(address);
        Logger.info(addressTransactions.map((tx) => tx.type));
        Logger.info(addressTransactions.length);
        // const totalBalance = await wallet.getBalanceFromAccount();
        // Logger.info(totalBalance);
        // Logger.info(totalBalance.nfts[0]);
        // const addresses = wallet.getAllAddresses();
        // Logger.info(addresses);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
        Logger.error(`${error.stack}`);
    }
};

main();
