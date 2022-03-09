import { Script, utils } from "@ckb-lumos/lumos";
import { TransactionSkeleton } from "@ckb-lumos/helpers";
import { sudt, common } from "@ckb-lumos/common-scripts";
import { ConnectionService } from "../connection.service";
import { TransactionService } from "../transaction.service";

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
        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getEmptyCellProvider() });
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
        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getCellProvider() });
        txSkeleton = await sudt.transfer(txSkeleton, [from], token, to, amount, undefined, undefined, undefined, {
            config: this.connection.getConfig(),
        });
        txSkeleton = await common.payFee(txSkeleton, [from], this.transactionService.defaultFee, null, this.connection.getConfigAsObject());

        return this.transactionService.signTransaction(txSkeleton, privateKey);
    }

    async getBalance(address: string): Promise<TokenAmount[]> {
        const collector = this.connection.getIndexer().collector({
            lock: this.connection.getLockFromAddress(address),
        });

        const tokenMap = new Map<string, number>();
        for await (const cell of collector.collect()) {
            if (this.isTokenScriptType(cell.cell_output.type)) {
                const key = cell.cell_output.type.args;

                if (!tokenMap.has(key)) {
                    tokenMap.set(key, Number(utils.readBigUInt128LE(cell.data)));
                } else {
                    tokenMap.set(key, Number(utils.readBigUInt128LE(cell.data)) + tokenMap.get(key));
                }
            }
        }

        const tokens: TokenAmount[] = [];
        const { CODE_HASH: codeHash, HASH_TYPE: hashType } = this.connection.getConfig().SCRIPTS.SUDT;
        tokenMap.forEach((value, key) =>
            tokens.push({
                type: { args: key, codeHash, hashType },
                amount: value,
            }),
        );

        return tokens;
    }

    private isTokenScriptType(script: Script): boolean {
        if (!script) {
            return false;
        }

        const sudtScript = this.connection.getConfig().SCRIPTS.SUDT;
        return script.code_hash === sudtScript.CODE_HASH && script.hash_type === sudtScript.HASH_TYPE;
    }
}
