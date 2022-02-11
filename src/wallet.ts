import { mnemonic, ExtendedPrivateKey, AccountExtendedPublicKey, AddressType } from "@ckb-lumos/hd";
import { config, helpers } from "@ckb-lumos/lumos";
import { Indexer } from "@ckb-lumos/base";

// AGGRON4 for test, LINA for main
const { AGGRON4 } = config.predefined;

export class Wallet {
    private privateKey: ExtendedPrivateKey;
    public accountPublicKey: AccountExtendedPublicKey;

    constructor(private readonly mnemo?: string) {
        if (!this.mnemo) {
            this.mnemo = mnemonic.generateMnemonic();
        }
        const seed = mnemonic.mnemonicToSeedSync(this.mnemo);
        this.privateKey = ExtendedPrivateKey.fromSeed(seed);
        this.accountPublicKey = this.privateKey.toAccountExtendedPublicKey();
    }

    getAddress(accountId = 0): string {
        const template = AGGRON4.SCRIPTS["SECP256K1_BLAKE160"];
        const lockScript = {
            code_hash: template.CODE_HASH,
            hash_type: template.HASH_TYPE,
            args: this.accountPublicKey.publicKeyInfo(AddressType.Receiving, accountId).blake160,
        };

        return helpers.generateAddress(lockScript, { config: AGGRON4 });
    }

    async getBalanceFromAccount(indexer: Indexer, accountId = 0): Promise<number> {
        const address = this.getAddress(accountId);
        return this.getBalance(indexer, address);
    }

    async getBalance(indexer: Indexer, address: string): Promise<number> {
        const collector = indexer.collector({
            lock: helpers.parseAddress(address, { config: AGGRON4 }),
        });

        let balance = 0;
        for await (const cell of collector.collect()) {
            balance += parseInt(cell.cell_output.capacity, 16);
        }

        return balance;
    }
}
