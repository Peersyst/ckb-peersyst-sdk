import { mnemonic, ExtendedPrivateKey, AccountExtendedPublicKey, AddressType } from "@ckb-lumos/hd";
import { ConnectionService } from "./connection.service";
import { TransactionService, Transaction } from "./transaction.service";

export class WalletService {
    private readonly connection: ConnectionService;
    private readonly transactionService: TransactionService;
    private readonly privateKey: ExtendedPrivateKey;
    private readonly accountPublicKey: AccountExtendedPublicKey;
    private addressMap = new Map<number, string>();

    constructor(connectionService: ConnectionService, private readonly mnemo?: string) {
        this.connection = connectionService;
        this.transactionService = new TransactionService(this.connection);

        if (!this.mnemo) {
            this.mnemo = mnemonic.generateMnemonic();
        }
        const seed = mnemonic.mnemonicToSeedSync(this.mnemo);
        this.privateKey = ExtendedPrivateKey.fromSeed(seed);
        this.accountPublicKey = this.privateKey.toAccountExtendedPublicKey();
    }

    getAddress(accountId = 0): string {
        if (!this.addressMap.has(accountId)) {
            const template = this.connection.getConfig().SCRIPTS["SECP256K1_BLAKE160"];
            const lockScript = {
                code_hash: template.CODE_HASH,
                hash_type: template.HASH_TYPE,
                args: this.accountPublicKey.publicKeyInfo(AddressType.Receiving, accountId).blake160,
            };

            const address = this.connection.getAddressFromLock(lockScript);
            this.addressMap.set(accountId, address);
        }

        return this.addressMap.get(accountId);
    }

    async getBalance(accountId = 0): Promise<number> {
        const address = this.getAddress(accountId);
        const collector = this.connection.getIndexer().collector({
            lock: this.connection.getLockFromAddress(address),
        });

        let balance = 0;
        for await (const cell of collector.collect()) {
            balance += parseInt(cell.cell_output.capacity, 16);
        }

        return balance;
    }

    async getTransactions(accountId = 0): Promise<Transaction[]> {
        const address = this.getAddress(accountId);

        return this.transactionService.getTransactions(address);
    }
}
