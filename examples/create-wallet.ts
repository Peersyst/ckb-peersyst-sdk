import { ConnectionService, Environments, WalletService, Logger } from "../src";

const ckbUrl = "http://78.46.174.87:8114/rpc";
const indexerUrl = "http://78.46.174.87:8114/indexer";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);

        const mnemonic = WalletService.createNewMnemonic();
        Logger.info(mnemonic); // Your new private key generator, save it

        // Wallet instance is necessary for all wallet functions
        const wallet = new WalletService(connectionService, mnemonic);

        // You can have more than 1 public address per mnemonic
        const addressAcc0 = wallet.getAddress(); // Default address is 0
        Logger.info(addressAcc0);
        const addressAcc1 = wallet.getAddress(1);
        Logger.info(addressAcc1);

        // To get your private key you need to put you mnemonic as sdk does not keep it
        const { privateKey } = wallet.getAddressAndPrivateKey(mnemonic);
        Logger.info(privateKey);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
