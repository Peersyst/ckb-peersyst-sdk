import { Cell } from "@ckb-lumos/lumos";
import * as NrcSdk from "@rather-labs/nrc-721-sdk";
import { ConnectionService } from "../connection.service";
import { NftScript, NftSdk } from "./nft.types";

export interface Nft {
    tokenId: string;
    tokenUri: string;
    data: any;
    nftName: string;
    nftSymbol: string;
    nftExtraData: string;
}

export class NftService {
    private readonly connection: ConnectionService;
    private nftSdk: NftSdk;

    constructor(connectionService: ConnectionService) {
        this.connection = connectionService;
    }

    async initialize() {
        if (!this.nftSdk) {
            this.nftSdk = await NrcSdk.initialize({
                nodeUrl: this.connection.getCKBUrl(),
                indexerUrl: this.connection.getIndexerUrl(),
            });
        }
    }

    private cellToNftScript(cell: Cell): NftScript {
        if (!cell.cell_output.type) {
            return null;
        }

        return {
            codeHash: cell.cell_output.type.code_hash,
            args: cell.cell_output.type.args,
            hashType: cell.cell_output.type.hash_type,
        };
    }

    async getBalance(address: string): Promise<Nft[]> {
        await this.initialize();

        const collector = this.connection.getIndexer().collector({
            lock: this.connection.getLockFromAddress(address),
        });

        const nfts: Nft[] = [];
        for await (const cell of collector.collect()) {
            const cellTypeScript = this.cellToNftScript(cell);

            let isNftCell: boolean;
            try {
                isNftCell = await this.nftSdk.nftCell.isCellNRC721(cellTypeScript);
            } catch (error) {
                isNftCell = false;
            }

            if (cellTypeScript && isNftCell) {
                const nft = await this.nftSdk.nftCell.read(cellTypeScript);

                nfts.push({
                    tokenId: nft.tokenId,
                    tokenUri: nft.tokenUri,
                    data: JSON.parse(nft.data),
                    nftName: nft.factoryData.name,
                    nftSymbol: nft.factoryData.symbol,
                    nftExtraData: nft.factoryData.extraData,
                });
            }
        }

        return nfts;
    }
}