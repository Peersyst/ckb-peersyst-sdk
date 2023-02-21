import { ConnectionService, Environments, WalletService, Logger, NftScript } from "../src";

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

        const nftContractTypeScript: NftScript = {
            codeHash: "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0xc2407f8b6ef27a10c35a55ab589e6bfc28db3f2fe5b08cab63384c88a02a14e6",
        };
        const factoryTypeScript: NftScript = {
            codeHash: "0x00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: "0x28e5cc5b13faa5cc36ec893bbe700ab637622e23a05db1cdcfa83b1b3f35b45c",
        };
        Logger.info(`address: ${address}`);

        await wallet.createNft(
            {
                nftContractTypeScript,
                factoryTypeScript,
                sourceAddress: address,
                targetAddress: "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqfrtj6zzh0sxnjlyh07cr0zy7znv25vp5s3qka64",
                fee: 0.0001,
                data: {
                    review: "Success",
                    description: "Jordis cool nft",
                    type: "NRC 721",
                },
            },
            privateKey,
        );
    } catch (error) {
        Logger.error(`${error.name}: ${error.message}`);
    }
};

main();
