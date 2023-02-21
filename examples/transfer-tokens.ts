import { ConnectionService, Environments, WalletService, Logger } from "../src";

// const ckbUrl = "http://78.46.174.87:8114/rpc";
// const indexerUrl = "http://78.46.174.87:8114/indexer";
const ckbUrl = "https://testnet.ckb.dev/rpc";
const indexerUrl = "https://testnet.ckb.dev/indexer";
const mnemonic = "teach act exotic into script once dutch choice menu elite apple faith";
const receivingAddress = "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqgkgzwqv9v9sxyzc83wkaqnsvl9tnqulnc96zxp3";
const token = "0x099472fc82e74d050d524ba32f8efc05d4a53800f4ab0bf88be9c3383586339a";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);

        // Wallet instance is necessary for all wallet functions
        const wallet = new WalletService(connectionService, mnemonic);

        const txHash = await wallet.transferTokens(20, mnemonic, receivingAddress, token);
        Logger.info(txHash);

        // You can view newly generated transaction through wallet.getTransactions
        // If you want to know transaction status
        const tokensBalance = wallet.getTokensBalance();
        Logger.info(tokensBalance);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
