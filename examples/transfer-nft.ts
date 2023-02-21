import { ConnectionService, Environments, WalletService, Logger, Nft } from "../src";

// const ckbUrl = "http://78.46.174.87:8114/rpc";
// const indexerUrl = "http://78.46.174.87:8114/indexer";
const ckbUrl = "https://testnet.ckb.dev/rpc";
const indexerUrl = "https://testnet.ckb.dev/indexer";
// const mnemonic = "private pond zero popular fashion omit february obscure pattern city camp pistol";
const mnemonic = "teach act exotic into script once dutch choice menu elite apple faith";
const receivingAddress = "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqgkgzwqv9v9sxyzc83wkaqnsvl9tnqulnc96zxp3";
const nft: Nft = {
    tokenId: "b9cdf17c6738d5e3333831ab370534816ce18c25d5354585f640be4eed14baa0",
    tokenUri: "https://avatars.githubusercontent.com/u/54996852?t=/b9cdf17c6738d5e3333831ab370534816ce18c25d5354585f640be4eed14baa0",
    data: {
        review: "Success",
        description: "Pablos cool nft",
        type: "NRC 721",
    },
    nftName: "Peersyst Test Token",
    nftSymbol: "PTT",
    nftExtraData: "506565727379737420746f6b656e2065787472612073656372657420636f6f6c2064617461",
    script: {
        codeHash: "0x9cef3391f34e14155caf019b47fc6e44ea31263ec87d62666ef0590f9defb774",
        args: "0x00000000000000000000000000000000000000000000000000545950455f49440128e5cc5b13faa5cc36ec893bbe700ab637622e23a05db1cdcfa83b1b3f35b45cb9cdf17c6738d5e3333831ab370534816ce18c25d5354585f640be4eed14baa0",
        hashType: "type",
    },
    rawData:
        "0x0ddeff3e8ee03cbf6a2c6920d05c381e00457b22726576696577223a2253756363657373222c226465736372697074696f6e223a225061626c6f7320636f6f6c206e6674222c2274797065223a224e524320373231227d00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
};

const main = async () => {
    try {
        const connectionService = new ConnectionService(ckbUrl, indexerUrl, Environments.Testnet);

        // Wallet instance is necessary for all wallet functions
        const wallet = new WalletService(connectionService, mnemonic);

        await wallet.synchronize();

        await wallet.transferNfts(mnemonic, receivingAddress, nft);
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
