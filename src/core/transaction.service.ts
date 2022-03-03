import { commons, hd, utils } from "@ckb-lumos/lumos";
import { sealTransaction, TransactionSkeletonType } from "@ckb-lumos/helpers";
import { TransactionWithStatus } from "@ckb-lumos/base";
import { TransactionCollector as TxCollector } from "@ckb-lumos/ckb-indexer";
import { ConnectionService } from "./connection.service";

export interface ScriptType {
    args: string;
    codeHash: string;
    hashType: string;
}

export interface DataRow {
    quantity: number;
    address: string;
    type?: ScriptType;
    data?: number;
}

export interface Transaction {
    status: string;
    transactionHash: string;
    inputs: DataRow[];
    outputs: DataRow[];
    blockHash: string;
    blockNumber: number;
    timestamp: Date;
}

export enum TransactionStatus {
    PENDING = "pending",
    PROPOSED = "proposed",
    COMMITTED = "committed",
    REJECTED = "rejected",
}

export class TransactionService {
    private readonly connection: ConnectionService;
    private readonly TransactionCollector: any;
    private readonly transactionMap = new Map<string, Transaction>();
    public readonly defaultFee = BigInt(100000);

    constructor(connectionService: ConnectionService) {
        this.connection = connectionService;
        this.TransactionCollector = TxCollector;
    }

    async getTransactions(address: string): Promise<Transaction[]> {
        const transactionCollector = new this.TransactionCollector(
            this.connection.getIndexer(),
            { lock: this.connection.getLockFromAddress(address) },
            this.connection.getCKBUrl(),
            { includeStatus: true },
        );

        const transactions: Transaction[] = [];
        let cell: TransactionWithStatus;
        for await (cell of transactionCollector.collect()) {
            if (!this.transactionMap.has(cell.transaction.hash)) {
                const header = await this.connection.getBlockHeaderFromHash(cell.tx_status.block_hash);

                const inputs: DataRow[] = [];
                for (let i = 0; i < cell.transaction.inputs.length; i += 1) {
                    const input = cell.transaction.inputs[i];
                    const transaction = await this.connection.getTransactionFromHash(input.previous_output.tx_hash);
                    const output = transaction.transaction.outputs[parseInt(input.previous_output.index, 16)];
                    inputs.push({
                        quantity: parseInt(output.capacity, 16) / 100000000,
                        address: this.connection.getAddressFromLock(output.lock),
                    });
                }

                const outputs: DataRow[] = cell.transaction.outputs.map((output) => ({
                    quantity: parseInt(output.capacity, 16) / 100000000,
                    address: this.connection.getAddressFromLock(output.lock),
                    type: output.type
                        ? { args: output.type.args, codeHash: output.type.code_hash, hashType: output.type.hash_type }
                        : undefined,
                }));
                cell.transaction.outputs_data.map((data, index) => {
                    if (data !== "0x") {
                        if (data.length === 34) {
                            outputs[index].data = Number(utils.readBigUInt128LE(data));
                        } else if (data.length === 18) {
                            outputs[index].data = Number(utils.readBigUInt64LE(data));
                        }
                    }
                });

                this.transactionMap.set(cell.transaction.hash, {
                    status: cell.tx_status.status,
                    transactionHash: cell.transaction.hash,
                    inputs,
                    outputs,
                    blockHash: cell.tx_status.block_hash,
                    blockNumber: parseInt(header.number, 16),
                    timestamp: new Date(parseInt(header.timestamp, 16)),
                });
            }

            const transaction = this.transactionMap.get(cell.transaction.hash);
            if (!transactions.includes(transaction)) {
                transactions.push(transaction);
            }
        }

        return transactions;
    }

    async signTransaction(txSkeleton: TransactionSkeletonType, privateKey: string): Promise<string> {
        const txSkeletonWEntries = commons.common.prepareSigningEntries(txSkeleton, this.connection.getConfigAsObject());
        const message = txSkeletonWEntries.get("signingEntries").get(0)?.message;
        const Sig = hd.key.signRecoverable(message, privateKey);
        const tx = sealTransaction(txSkeletonWEntries, [Sig]);
        const hash = await this.connection.getRPC().send_transaction(tx, "passthrough");

        return hash;
    }
}
