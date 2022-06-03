import { ConnectionService, Environments, WalletService, Logger, AddressType } from "../src";

const ckbUrl = "http://localhost:8117/rpc";
const indexerUrl = "http://localhost:8117/indexer";
const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);
        const wallet = new WalletService(connectionService, mnemonic);
        await wallet.synchronize();

        const balanceAcc0Rec = await wallet.getBalanceFromAccount(0, AddressType.Receiving);
        Logger.info(balanceAcc0Rec);
        const balanceAcc0Chg = await wallet.getBalanceFromAccount(0, AddressType.Change);
        Logger.info(balanceAcc0Chg);
        const balanceAcc1 = await wallet.getBalanceFromAccount(1, AddressType.Receiving);
        Logger.info(balanceAcc1);
        const totalBalance = await wallet.getBalance();
        Logger.info(totalBalance);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
