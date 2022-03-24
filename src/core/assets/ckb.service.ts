import { TransactionSkeleton } from "@ckb-lumos/helpers";
import { common } from "@ckb-lumos/common-scripts";
import { ConnectionService } from "../connection.service";
import { TransactionService } from "../transaction.service";
import { Cell } from "@ckb-lumos/lumos";

export interface CKBBalance {
    totalBalance: bigint;
    occupiedBalance: bigint;
    freeBalance: bigint;
}

export class CKBService {
    private readonly connection: ConnectionService;
    private readonly transactionService: TransactionService;
    private readonly transferCellSize = BigInt(61 * 10 ** 8);
    private readonly transferData = "0x";

    constructor(connectionService: ConnectionService, transactionService: TransactionService) {
        this.connection = connectionService;
        this.transactionService = transactionService;
    }

    async transfer(from: string, to: string, amount: bigint, privateKey: string): Promise<string> {
        if (amount < this.transferCellSize) {
            throw new Error("Minimum transfer (cell) value is 61 CKB");
        }

        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getEmptyCellProvider() });
        txSkeleton = await common.transfer(txSkeleton, [from], to, amount, null, null, this.connection.getConfigAsObject());
        txSkeleton = await common.payFee(txSkeleton, [from], this.transactionService.defaultFee, null, this.connection.getConfigAsObject());

        return this.transactionService.signTransaction(txSkeleton, [privateKey]);
    }

    async transferFromCells(cells: Cell[], fromAddresses: string[], to: string, amount: bigint, privateKeys: string[]): Promise<string> {
        if (amount < this.transferCellSize) {
            throw new Error("Minimum transfer (cell) value is 61 CKB");
        }

        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getEmptyCellProvider() });

        // Add output
        const toScript = this.connection.getLockFromAddress(to);
        txSkeleton = txSkeleton.update("outputs", (outputs) => {
            return outputs.push({
                cell_output: {
                    capacity: "0x" + amount.toString(16),
                    lock: toScript,
                },
                data: this.transferData,
            });
        });

        txSkeleton = this.transactionService.addSecp256CellDep(txSkeleton);
        // Inject capacity
        const capacityResp = this.transactionService.injectCapacity(txSkeleton, amount, cells);
        txSkeleton = capacityResp.txSkeleton;

        txSkeleton = await common.payFee(
            txSkeleton,
            fromAddresses,
            this.transactionService.defaultFee,
            null,
            this.connection.getConfigAsObject(),
        );

        const signingPrivKeys: string[] = [];
        for (const addressToSign of capacityResp.addressesToSign) {
            signingPrivKeys.push(privateKeys[fromAddresses.indexOf(addressToSign)]);
        }

        return this.transactionService.signTransaction(txSkeleton, signingPrivKeys);
    }

    async getBalance(address: string): Promise<CKBBalance> {
        const collector = this.connection.getIndexer().collector({
            lock: this.connection.getLockFromAddress(address),
        });

        const cells: Cell[] = [];
        for await (const cell of collector.collect()) {
            cells.push(cell);
        }

        return this.getBalanceFromCells(cells);
    }

    getBalanceFromCells(cells: Cell[]): CKBBalance {
        let totalBalance = BigInt(0);
        let occupiedBalance = BigInt(0);

        for (const cell of cells) {
            totalBalance += BigInt(cell.cell_output.capacity);
            if (cell.cell_output.type) {
                occupiedBalance += BigInt(cell.cell_output.capacity);
            }
        }
        const freeBalance = totalBalance - occupiedBalance;

        return { totalBalance, occupiedBalance, freeBalance };
    }
}
