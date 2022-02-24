import { TransactionSkeleton } from "@ckb-lumos/helpers";
import { common } from "@ckb-lumos/common-scripts";
import { ConnectionService } from "./connection.service";
import { TransactionService } from "./transaction.service";

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

        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getIndexer() });
        txSkeleton = await common.transfer(txSkeleton, [from], to, amount, null, null, this.connection.getConfigAsObject());
        txSkeleton = await common.payFee(txSkeleton, [from], this.transactionService.defaultFee, null, this.connection.getConfigAsObject());

        return this.transactionService.signTransaction(txSkeleton, privateKey);
    }
}
