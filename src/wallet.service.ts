import { mnemonic, ExtendedPrivateKey, AccountExtendedPublicKey, AddressType } from "@ckb-lumos/hd";
import { utils } from "@ckb-lumos/base";
import { ConnectionService } from "./connection.service";
import { TransactionService, Transaction } from "./transaction.service";
import { TokenService, TokenAmount } from "./token.service";
import { CKBService } from "./ckb.service";
import { DAOService, DAOStatistics } from "./dao.service";
import { Cell } from "@ckb-lumos/lumos";

export enum AddressScriptType {
    SECP256K1_BLAKE160 = "SECP256K1_BLAKE160",
    SUDT = "SUDT",
    DAO = "DAO",
}

export class WalletService {
    private readonly connection: ConnectionService;
    private readonly transactionService: TransactionService;
    private readonly ckbService: CKBService;
    private readonly tokenService: TokenService;
    private readonly daoService: DAOService;
    private readonly accountPublicKey: AccountExtendedPublicKey;
    private readonly addressType = AddressType.Receiving;
    private addressMap = new Map<string, string>();

    constructor(connectionService: ConnectionService, mnemo?: string) {
        this.connection = connectionService;
        this.transactionService = new TransactionService(this.connection);
        this.ckbService = new CKBService(this.connection, this.transactionService);
        this.tokenService = new TokenService(this.connection, this.transactionService);
        this.daoService = new DAOService(this.connection, this.transactionService);

        if (!mnemo) {
            mnemo = mnemonic.generateMnemonic();
        }
        this.accountPublicKey = WalletService.getPrivateKeyFromMnemonic(mnemo).toAccountExtendedPublicKey();
    }

    static getPrivateKeyFromMnemonic(mnemo: string): ExtendedPrivateKey {
        const seed = mnemonic.mnemonicToSeedSync(mnemo);
        return ExtendedPrivateKey.fromSeed(seed);
    }

    // ----------------------
    // -- Wallet functions --
    // ----------------------
    getAddress(accountId = 0, script: AddressScriptType = AddressScriptType.SECP256K1_BLAKE160): string {
        const key = `${accountId}-${script}`;
        if (!this.addressMap.has(key)) {
            const template = this.connection.getConfig().SCRIPTS[script];
            const lockScript = {
                code_hash: template.CODE_HASH,
                hash_type: template.HASH_TYPE,
                args: this.accountPublicKey.publicKeyInfo(this.addressType, accountId).blake160,
            };

            const address = this.connection.getAddressFromLock(lockScript);
            this.addressMap.set(key, address);
        }

        return this.addressMap.get(key);
    }

    getAddressAndPrivateKey(
        mnemo: string,
        accountId = 0,
        script: AddressScriptType = AddressScriptType.SECP256K1_BLAKE160,
    ): { address: string; privateKey: string } {
        const address = this.getAddress(accountId, script);
        const extPrivateKey = WalletService.getPrivateKeyFromMnemonic(mnemo);
        const privateKey = extPrivateKey.privateKeyInfo(this.addressType, accountId).privateKey;
        // const privateKey = extPrivateKey.privateKey;

        return { address, privateKey };
    }

    // Useless
    getAllAddresses(accountId = 0): any {
        const ckbAddress = this.getAddress(accountId, AddressScriptType.SECP256K1_BLAKE160);
        const tokenAddress = this.getAddress(accountId, AddressScriptType.SUDT);
        const daoAddress = this.getAddress(accountId, AddressScriptType.DAO);

        return { ckbAddress, tokenAddress, daoAddress };
    }

    async getBalance(accountId = 0): Promise<bigint> {
        // FILTER BY SCRIPT?? EXPLORER DOES NOT
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
        // FILTER BY SCRIPT
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

    // -----------------------------------
    // -- Transaction service functions --
    // -----------------------------------
    async getTransactions(accountId = 0): Promise<Transaction[]> {
        const address = this.getAddress(accountId);

        return this.transactionService.getTransactions(address);
    }

    // ---------------------------
    // -- CKB service functions --
    // ---------------------------
    async sendTransaction(amount: bigint, mnemo: string, to: string, accountId = 0): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);

        return this.ckbService.transfer(address, to, BigInt(amount), privateKey);
    }

    // -----------------------------
    // -- Token service functions --
    // -----------------------------
    async issueTokens(amount: number, mnemo: string, accountId = 0): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);

        return this.tokenService.issue(address, amount, privateKey);
    }

    async transferTokens(amount: number, mnemo: string, to: string, token: string, accountId = 0): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);

        return this.tokenService.transfer(address, to, token, amount, privateKey);
    }

    // ---------------------------
    // -- DAO Service functions --
    // ---------------------------
    async depositInDAO(amount: bigint, mnemo: string, to: string, accountId = 0): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);

        return this.daoService.deposit(amount, address, address, privateKey);
    }

    async withdrawFromDAO(cell: Cell, mnemo: string, accountId = 0): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);
        return this.daoService.withdraw(cell, privateKey, address);
    }

    async unlock(cell: Cell, mnemo: string, to: string, accountId = 0): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);
        return this.daoService.unlock(cell, privateKey, address, to);
    }

    async getDAOCells(address: string): Promise<Cell[]> {
        return this.daoService.getCells(address);
    }

    async getDAOStatistics(accountId = 0): Promise<DAOStatistics> {
        const address = this.getAddress(accountId);
        return this.daoService.getStatistics(address);
    }
}
