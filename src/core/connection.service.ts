import { RPC, config, Script, helpers, OutPoint, Indexer } from "@ckb-lumos/lumos";
import { TransactionWithStatus, Header, ChainInfo, CellWithStatus, Indexer as IndexerType } from "@ckb-lumos/base";

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
    private blockHeaderNumberMap = new Map<string, Header>();
    private blockHeaderHashMap = new Map<string, Header>();
    private transactionMap = new Map<string, TransactionWithStatus>();

    constructor(ckbUrl: string, indexerUrl: string, env: Environments) {
        this.ckbUrl = ckbUrl;
        this.indexerUrl = indexerUrl;
        this.env = env;
        this.rpc = new RPC(this.ckbUrl);
        this.indexer = new Indexer(this.indexerUrl, this.ckbUrl);
        this.config = env === Environments.Mainnet ? LINA : AGGRON4;
        config.initializeConfig(this.config);
    }

    async getBlockchainInfo(): Promise<ChainInfo> {
        return this.rpc.get_blockchain_info();
    }

    setBlockHeaderMaps(header: Header): void {
        this.blockHeaderHashMap.set(header.hash, header);
        this.blockHeaderNumberMap.set(header.number, header);
    }

    async getCurrentBlockHeader(): Promise<Header> {
        const lastBlockHeader = await this.rpc.get_tip_header();
        this.setBlockHeaderMaps(lastBlockHeader);
        return lastBlockHeader;
    }

    async getBlockHeaderFromHash(blockHash: string): Promise<Header> {
        if (!this.blockHeaderHashMap.has(blockHash)) {
            const header = await this.rpc.get_header(blockHash);
            this.setBlockHeaderMaps(header);
        }
        return this.blockHeaderHashMap.get(blockHash);
    }

    async getBlockHeaderFromNumber(blockNumber: string): Promise<Header> {
        if (!this.blockHeaderNumberMap.has(blockNumber)) {
            const header = await this.rpc.get_header_by_number(blockNumber);
            this.setBlockHeaderMaps(header);
        }
        return this.blockHeaderNumberMap.get(blockNumber);
    }

    async getCell(outPoint: OutPoint): Promise<CellWithStatus> {
        return this.rpc.get_live_cell(outPoint, true);
    }

    async getTransactionFromHash(transactionHash: string, useMap = true): Promise<TransactionWithStatus> {
        if (!useMap || !this.transactionMap.has(transactionHash)) {
            const transaction = await this.rpc.get_transaction(transactionHash);
            this.transactionMap.set(transactionHash, transaction);
        }
        return this.transactionMap.get(transactionHash);
    }

    getConfig(): configType {
        return this.config;
    }

    getConfigAsObject(): helpers.Options {
        return { config: this.config };
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

    getIndexerUrl(): string {
        return this.indexerUrl;
    }

    getAddressFromLock(lock: Script): string {
        return helpers.generateAddress(lock, { config: this.config });
    }

    getLockFromAddress(address: string): Script {
        return helpers.parseAddress(address, { config: this.config });
    }
}
