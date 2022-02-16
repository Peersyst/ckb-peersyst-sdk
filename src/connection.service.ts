import { Indexer, RPC, config, Script, helpers } from "@ckb-lumos/lumos";
import { TransactionWithStatus, Block, ChainInfo, Indexer as IndexerType } from "@ckb-lumos/base";

// AGGRON4 for test, LINA for main
const { AGGRON4, LINA } = config.predefined;

export enum Environments {
    Mainnet = "mainnet",
    Testnet = "testnet",
}

export type configType = typeof AGGRON4 | typeof LINA;

export class ConnectionService {
    private readonly ckbUrl: string;
    private readonly indexerUrl: string;
    private readonly env: Environments;
    private readonly rpc: RPC;
    private readonly indexer: IndexerType;
    private readonly config: configType;
    private blockMap = new Map<string, Block>();
    private transactionMap = new Map<string, TransactionWithStatus>();

    constructor(ckbUrl: string, indexerUrl: string, env: Environments) {
        this.ckbUrl = ckbUrl;
        this.indexerUrl = indexerUrl;
        this.env = env;
        this.rpc = new RPC(this.ckbUrl);
        this.indexer = new Indexer(this.indexerUrl, this.ckbUrl);
        this.config = env === Environments.Mainnet ? LINA : AGGRON4;
    }

    async getBlockchainInfo(): Promise<ChainInfo> {
        return this.rpc.get_blockchain_info();
    }

    async getBlockFromHash(blockHash: string): Promise<Block> {
        if (!this.blockMap.has(blockHash)) {
            const block = await this.rpc.get_block(blockHash);
            this.blockMap.set(blockHash, block);
        }
        return this.blockMap.get(blockHash);
    }

    async getTransactionFromHash(transactionHash: string): Promise<TransactionWithStatus> {
        if (!this.transactionMap.has(transactionHash)) {
            const transaction = await this.rpc.get_transaction(transactionHash);
            this.transactionMap.set(transactionHash, transaction);
        }
        return this.transactionMap.get(transactionHash);
    }

    getConfig(): configType {
        return this.config;
    }

    getRPC(): RPC {
        return this.rpc;
    }

    getIndexer(): IndexerType {
        return this.indexer;
    }

    getCKBUrl(): string {
        return this.ckbUrl;
    }

    getAddressFromLock(lock: Script): string {
        return helpers.generateAddress(lock, { config: this.config });
    }

    getLockFromAddress(address: string): Script {
        return helpers.parseAddress(address, { config: this.config });
    }
}
