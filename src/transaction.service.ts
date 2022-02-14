import { TransactionWithStatus } from "@ckb-lumos/base";
import { TransactionCollector as TxCollector } from "@ckb-lumos/ckb-indexer";
import { ConnectionService } from "./connection.service";

export interface DataRow {
    quantity: number;
    address: string;
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

export class TransactionService {
    private readonly connection: ConnectionService;
    private readonly TransactionCollector: any;

    constructor(connectionService: ConnectionService, TransactionCollector = TxCollector) {
        this.connection = connectionService;
        this.TransactionCollector = TransactionCollector;
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
            const block = await this.connection.getBlockFromHash(cell.tx_status.block_hash);

            const inputs = [];
            for (let i = 0; i < cell.transaction.inputs.length; i += 1) {
                const input = cell.transaction.inputs[i];
                const transaction = await this.connection.getTransactionFromHash(input.previous_output.tx_hash);
                const output = transaction.transaction.outputs[parseInt(input.previous_output.index, 16)];
                inputs.push({
                    quantity: parseInt(output.capacity, 16) / 100000000,
                    address: this.connection.getAddressFromLock(output.lock),
                });
            }

            const outputs = cell.transaction.outputs.map((output) => ({
                quantity: parseInt(output.capacity, 16) / 100000000,
                address: this.connection.getAddressFromLock(output.lock),
            }));

            transactions.push({
                status: cell.tx_status.status,
                transactionHash: cell.transaction.hash,
                inputs,
                outputs,
                blockHash: cell.tx_status.block_hash,
                blockNumber: parseInt(block.header.number, 16),
                timestamp: new Date(parseInt(block.header.timestamp, 16)),
            });
        }

        return transactions;
    }
}
