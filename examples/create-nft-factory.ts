import { ConnectionService, Environments, WalletService, Logger } from "../src";

// const ckbUrl = "http://78.46.174.87:8114/rpc";
// const indexerUrl = "http://78.46.174.87:8114/indexer";
const ckbUrl = "https://testnet.ckb.dev/rpc";
const indexerUrl = "https://testnet.ckb.dev/indexer";
// const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";
const mnemonic = "teach act exotic into script once dutch choice menu elite apple faith";

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);

        // Wallet instance is necessary for all wallet functions
        const wallet = new WalletService(connectionService, mnemonic);

        await wallet.synchronize();
        const { address, privateKey } = wallet.getAddressAndPrivateKey(mnemonic, 0);
        Logger.info(`address: ${address}`);

        await wallet.createNftFactory(
            {
                name: "Peersyst Test Token",
                symbol: "PTT",
                baseTokenUri: "https://avatars.githubusercontent.com/u/54996852?t=",
                sourceAddress: address,
                targetAddress: address,
                fee: 0.0001,
                extraData: Buffer.from("Peersyst token extra secret cool data"),
            },
            privateKey,
        );
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
