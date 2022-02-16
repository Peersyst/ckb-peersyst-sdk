import { helpers, toolkit, WitnessArgs, core, commons, hd } from "@ckb-lumos/lumos";
import { TransactionWithStatus, Cell, values } from "@ckb-lumos/base";
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

    async transfer(from: string, to: string, amount: bigint, privateKey: string): Promise<string> {
        let txSkeleton = helpers.TransactionSkeleton({});
        const fromScript = this.connection.getLockFromAddress(from);
        const toScript = this.connection.getLockFromAddress(to);

        // additional 0.001 ckb for tx fee
        // the tx fee could calculated by tx size
        // this is just a simple example
        const neededCapacity = amount + BigInt(100000);
        let collectedSum = BigInt(0);
        const collected: Cell[] = [];
        const collector = this.connection.getIndexer().collector({ lock: fromScript, type: "empty" });
        for await (const cell of collector.collect()) {
            collectedSum += BigInt(cell.cell_output.capacity);
            collected.push(cell);
            if (collectedSum >= neededCapacity) break;
        }

        if (collectedSum < neededCapacity) {
            throw new Error("Not enough CKB");
        }

        const transferOutput: Cell = {
            cell_output: {
                capacity: "0x" + amount.toString(16),
                lock: toScript,
            },
            data: "0x",
        };

        const changeOutput: Cell = {
            cell_output: {
                capacity: "0x" + BigInt(collectedSum - neededCapacity).toString(16),
                lock: fromScript,
            },
            data: "0x",
        };

        txSkeleton = txSkeleton.update("inputs", (inputs) => inputs.push(...collected));
        txSkeleton = txSkeleton.update("outputs", (outputs) => outputs.push(transferOutput, changeOutput));
        txSkeleton = txSkeleton.update("cellDeps", (cellDeps) =>
            cellDeps.push({
                out_point: {
                    tx_hash: this.connection.getConfig().SCRIPTS.SECP256K1_BLAKE160.TX_HASH,
                    index: this.connection.getConfig().SCRIPTS.SECP256K1_BLAKE160.INDEX,
                },
                dep_type: this.connection.getConfig().SCRIPTS.SECP256K1_BLAKE160.DEP_TYPE,
            }),
        );

        const firstIndex = txSkeleton
            .get("inputs")
            .findIndex((input) =>
                new values.ScriptValue(input.cell_output.lock, { validate: false }).equals(
                    new values.ScriptValue(fromScript, { validate: false }),
                ),
            );
        if (firstIndex !== -1) {
            while (firstIndex >= txSkeleton.get("witnesses").size) {
                txSkeleton = txSkeleton.update("witnesses", (witnesses) => witnesses.push("0x"));
            }
            let witness: string = txSkeleton.get("witnesses").get(firstIndex);
            const newWitnessArgs: WitnessArgs = {
                /* 65-byte zeros in hex */
                lock: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
            };
            if (witness !== "0x") {
                const witnessArgs = new core.WitnessArgs(new toolkit.Reader(witness));
                const lock = witnessArgs.getLock();
                if (lock.hasValue() && new toolkit.Reader(lock.value().raw()).serializeJson() !== newWitnessArgs.lock) {
                    throw new Error("Lock field in first witness is set aside for signature!");
                }

                const inputType = witnessArgs.getInputType();
                if (inputType.hasValue()) {
                    newWitnessArgs.input_type = new toolkit.Reader(inputType.value().raw()).serializeJson();
                }

                const outputType = witnessArgs.getOutputType();
                if (outputType.hasValue()) {
                    newWitnessArgs.output_type = new toolkit.Reader(outputType.value().raw()).serializeJson();
                }
            }

            witness = new toolkit.Reader(
                core.SerializeWitnessArgs(toolkit.normalizers.NormalizeWitnessArgs(newWitnessArgs)),
            ).serializeJson();
            txSkeleton = txSkeleton.update("witnesses", (witnesses) => witnesses.set(firstIndex, witness));
        }

        txSkeleton = commons.common.prepareSigningEntries(txSkeleton);
        const message = txSkeleton.get("signingEntries").get(0)?.message;
        const Sig = hd.key.signRecoverable(message, privateKey);
        const tx = helpers.sealTransaction(txSkeleton, [Sig]);
        const hash = await this.connection.getRPC().send_transaction(tx, "passthrough");
        console.log("The transaction hash is", hash);

        return hash;
    }
}
