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
