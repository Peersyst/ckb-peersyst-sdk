import { toolkit, WitnessArgs, core, commons, hd } from "@ckb-lumos/lumos";
import { sealTransaction, TransactionSkeleton, TransactionSkeletonType, scriptToAddress } from "@ckb-lumos/helpers";
import { TransactionWithStatus, Cell, values, CellCollector } from "@ckb-lumos/base";
import { TransactionCollector as TxCollector } from "@ckb-lumos/ckb-indexer";
import { ScriptConfig } from "@ckb-lumos/config-manager";
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
    private readonly transactionMap = new Map<string, Transaction>();
    private readonly transferCellSize = BigInt(61 * 10 ** 8);
    private readonly usdtCellSize = BigInt(142 * 10 ** 8);
    private readonly defaultFee = BigInt(100000);

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

                this.transactionMap.set(cell.transaction.hash, {
                    status: cell.tx_status.status,
                    transactionHash: cell.transaction.hash,
                    inputs,
                    outputs,
                    blockHash: cell.tx_status.block_hash,
                    blockNumber: parseInt(block.header.number, 16),
                    timestamp: new Date(parseInt(block.header.timestamp, 16)),
                });
            }

            const transaction = this.transactionMap.get(cell.transaction.hash);
            if (!transactions.includes(transaction)) {
                transactions.push(transaction);
            }
        }

        return transactions;
    }

    async issueTokens(address: string, amount: number, privateKey: string): Promise<string> {
        const addressScript = this.connection.getLockFromAddress(address);
        const collector = this.connection.getIndexer().collector({ lock: addressScript, type: "empty" });
        const deps = [this.connection.getConfig().SCRIPTS.SECP256K1_BLAKE160, this.connection.getConfig().SCRIPTS.SUDT];

        const txSkeleton = await this.generateRawTransaction(address, address, this.usdtCellSize, this.defaultFee, collector, deps);
        const firstOutputCell = txSkeleton.outputs.get(0);
        firstOutputCell.cell_output.type = {
            code_hash: this.connection.getConfig().SCRIPTS.SUDT.CODE_HASH,
            hash_type: this.connection.getConfig().SCRIPTS.SUDT.HASH_TYPE,
            // args: addressScript.args,
            args: scriptToAddress(addressScript),
        };
        firstOutputCell.data = `0x${Buffer.from(amount.toString(16).padStart(32, "0"), "hex").reverse().toString("hex")}`;
        txSkeleton.outputs.set(0, firstOutputCell);

        return this.signTransaction(txSkeleton, privateKey);
    }

    async transfer(from: string, to: string, amount: bigint, privateKey: string): Promise<string> {
        if (amount < this.transferCellSize) {
            throw new Error("Minimum transfer (cell) value is 61 CKB");
        }

        const fromScript = this.connection.getLockFromAddress(from);
        const collector = this.connection.getIndexer().collector({ lock: fromScript, type: "empty" });
        const deps = [this.connection.getConfig().SCRIPTS.SECP256K1_BLAKE160];

        const txSkeleton = await this.generateRawTransaction(from, to, amount, this.defaultFee, collector, deps);

        return this.signTransaction(txSkeleton, privateKey);
    }

    async signTransaction(txSkeleton: TransactionSkeletonType, privateKey: string): Promise<string> {
        const message = txSkeleton.get("signingEntries").get(0)?.message;
        const Sig = hd.key.signRecoverable(message, privateKey);
        const tx = sealTransaction(txSkeleton, [Sig]);
        const hash = await this.connection.getRPC().send_transaction(tx, "passthrough");

        return hash;
    }

    async generateRawTransaction(
        from: string,
        to: string,
        capacity: bigint,
        fee: bigint,
        collector: CellCollector,
        deps: ScriptConfig[],
    ): Promise<TransactionSkeletonType> {
        let txSkeleton = TransactionSkeleton({});
        const fromScript = this.connection.getLockFromAddress(from);
        const toScript = this.connection.getLockFromAddress(to);

        // Additional 0.001 ckb for tx fee, could calculated by tx size
        const neededCapacity = capacity + fee;
        const neededCells: Cell[] = [];
        let collectedSum = BigInt(0);

        for await (const cell of collector.collect()) {
            collectedSum += BigInt(cell.cell_output.capacity);
            neededCells.push(cell);
            if (collectedSum >= neededCapacity) break;
        }

        if (collectedSum < neededCapacity) {
            throw new Error("Not enough CKB");
        }

        const transferOutput: Cell = {
            cell_output: {
                capacity: "0x" + capacity.toString(16),
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

        txSkeleton = txSkeleton.update("inputs", (inputs) => inputs.push(...neededCells));
        txSkeleton = txSkeleton.update("outputs", (outputs) => outputs.push(transferOutput, changeOutput));
        txSkeleton = txSkeleton.update("cellDeps", (cellDeps) =>
            cellDeps.push(
                ...deps.map((dep) => ({
                    out_point: { tx_hash: dep.TX_HASH, index: dep.INDEX },
                    dep_type: dep.DEP_TYPE,
                })),
            ),
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

        return txSkeleton;
    }
}
