import { TransactionSkeleton } from "@ckb-lumos/helpers";
import { sudt, common } from "@ckb-lumos/common-scripts";
import { ConnectionService } from "./connection.service";
import { TransactionService } from "./transaction.service";

export interface TokenType {
    args: string;
    codeHash: string;
    hashType: string;
}
export interface TokenAmount {
    type: TokenType;
    amount: number;
}

export class TokenService {
    private readonly connection: ConnectionService;
    private readonly transactionService: TransactionService;
    // private readonly sudtCellSize = BigInt(142 * 10 ** 8);

    constructor(connectionService: ConnectionService, transactionService: TransactionService) {
        this.connection = connectionService;
        this.transactionService = transactionService;
    }

    async issue(address: string, amount: number, privateKey: string): Promise<string> {
        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getIndexer() });
        txSkeleton = await sudt.issueToken(txSkeleton, address, amount, undefined, undefined, this.connection.getConfigAsObject());
        txSkeleton = await common.payFee(
            txSkeleton,
            [address],
            this.transactionService.defaultFee,
            null,
            this.connection.getConfigAsObject(),
        );

        return this.transactionService.signTransaction(txSkeleton, privateKey);
    }

    async transfer(from: string, to: string, token: string, amount: number, privateKey: string): Promise<string> {
        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getIndexer() });
        txSkeleton = await sudt.transfer(txSkeleton, [from], token, to, amount, undefined, undefined, undefined, {
            config: this.connection.getConfig(),
        });
        txSkeleton = await common.payFee(txSkeleton, [from], this.transactionService.defaultFee, null, this.connection.getConfigAsObject());

        // console.log(JSON.stringify(txSkeleton, null, 2));
        // return "hola";
        return this.transactionService.signTransaction(txSkeleton, privateKey);
    }
}
