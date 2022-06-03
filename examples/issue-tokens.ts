import { ConnectionService, Environments, WalletService, Logger } from "../src";

const ckbUrl = "http://localhost:8117/rpc";
const indexerUrl = "http://localhost:8117/indexer";
const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);
        const wallet = new WalletService(connectionService, mnemonic);

        const txHash = await wallet.issueTokens(1000, mnemonic);
        Logger.info(txHash);

        // This balance will be updated when we sync after the tx status is committed
        await wallet.synchronize();
        const tokensBalance = wallet.getTokensBalance();
        Logger.info(tokensBalance);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
