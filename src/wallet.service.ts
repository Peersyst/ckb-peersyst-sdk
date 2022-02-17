import { mnemonic, ExtendedPrivateKey, AccountExtendedPublicKey, AddressType } from "@ckb-lumos/hd";
import { utils } from "@ckb-lumos/base";
import { ConnectionService } from "./connection.service";
import { TransactionService, Transaction } from "./transaction.service";

export interface TokenType {
    args: string;
    codeHash: string;
    hashType: string;
}
export interface TokenAmount {
    type: TokenType;
    amount: number;
}

export class WalletService {
    private readonly connection: ConnectionService;
    private readonly transactionService: TransactionService;
    private readonly accountPublicKey: AccountExtendedPublicKey;
    private readonly addressType = AddressType.Receiving;
    private addressMap = new Map<number, string>();

    constructor(connectionService: ConnectionService, mnemo?: string) {
        this.connection = connectionService;
        this.transactionService = new TransactionService(this.connection);

        if (!mnemo) {
            mnemo = mnemonic.generateMnemonic();
        }
        this.accountPublicKey = WalletService.getPrivateKeyFromMnemonic(mnemo).toAccountExtendedPublicKey();
    }

    static getPrivateKeyFromMnemonic(mnemo: string): ExtendedPrivateKey {
        const seed = mnemonic.mnemonicToSeedSync(mnemo);
        return ExtendedPrivateKey.fromSeed(seed);
    }

    getAddress(accountId = 0): string {
        if (!this.addressMap.has(accountId)) {
            const template = this.connection.getConfig().SCRIPTS["SECP256K1_BLAKE160"];
            const lockScript = {
                code_hash: template.CODE_HASH,
                hash_type: template.HASH_TYPE,
                args: this.accountPublicKey.publicKeyInfo(this.addressType, accountId).blake160,
            };

            const address = this.connection.getAddressFromLock(lockScript);
            this.addressMap.set(accountId, address);
        }

        return this.addressMap.get(accountId);
    }

    async getBalance(accountId = 0): Promise<bigint> {
        const address = this.getAddress(accountId);
        const collector = this.connection.getIndexer().collector({
            lock: this.connection.getLockFromAddress(address),
        });

        let balance = BigInt(0);
        for await (const cell of collector.collect()) {
            balance += BigInt(cell.cell_output.capacity);
        }

        return balance;
    }

    async getTokensBalance(accountId = 0): Promise<TokenAmount[]> {
        const address = this.getAddress(accountId);
        const collector = this.connection.getIndexer().collector({
            lock: this.connection.getLockFromAddress(address),
        });

        const tokenMap = new Map<string, number>();
        for await (const cell of collector.collect()) {
            if (cell.cell_output.type) {
                const { args, code_hash, hash_type } = cell.cell_output.type;
                const key = [args, code_hash, hash_type].join(",");

                if (!tokenMap.has(key)) {
                    tokenMap.set(key, Number(utils.readBigUInt128LE(cell.data)));
                } else {
                    tokenMap.set(key, Number(utils.readBigUInt128LE(cell.data)) + tokenMap.get(key));
                }
            }
        }

        const tokens: TokenAmount[] = [];
        tokenMap.forEach((value, key) =>
            tokens.push({
                type: { args: key.split(",")[0], codeHash: key.split(",")[1], hashType: key.split(",")[2] },
                amount: value,
            }),
        );

        return tokens;
    }

    async getTransactions(accountId = 0): Promise<Transaction[]> {
        const address = this.getAddress(accountId);

        return this.transactionService.getTransactions(address);
    }

    async sendTransaction(amount: bigint, mnemo: string, to: string, accountId = 0): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);

        return this.transactionService.transfer(address, to, BigInt(amount), privateKey);
    }

    async issueTokens(amount: number, mnemo: string, accountId = 0): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);

        return this.transactionService.issueTokens(address, amount, privateKey);
    }

    async transferTokens(amount: number, mnemo: string, to: string, token: string, accountId = 0): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);

        return this.transactionService.transferTokens(address, to, token, amount, privateKey);
    }

    getAddressAndPrivateKey(mnemo: string, accountId = 0): { address: string; privateKey: string } {
        const address = this.getAddress(accountId);
        const extPrivateKey = WalletService.getPrivateKeyFromMnemonic(mnemo);
        const privateKey = extPrivateKey.privateKeyInfo(this.addressType, accountId).privateKey;

        return { address, privateKey };
    }
}
