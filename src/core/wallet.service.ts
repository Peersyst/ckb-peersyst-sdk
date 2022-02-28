import { mnemonic, ExtendedPrivateKey, AccountExtendedPublicKey, AddressType } from "@ckb-lumos/hd";
import { ConnectionService } from "./connection.service";
import { TransactionService, Transaction, TransactionStatus } from "./transaction.service";
import { TokenService, TokenAmount } from "./assets/token.service";
import { CKBBalance, CKBService } from "./assets/ckb.service";
import { DAOBalance, DAOService, DAOStatistics, DAOUnlockableAmount } from "./dao/dao.service";
import { Cell } from "@ckb-lumos/lumos";
import { TransactionWithStatus } from "@ckb-lumos/base";
import { Nft, NftService } from "./assets/nft.service";
import { Logger } from "../utils/logger";

export enum AddressScriptType {
    SECP256K1_BLAKE160 = "SECP256K1_BLAKE160",
    SUDT = "SUDT",
    DAO = "DAO",
}

export interface Balance {
    ckb: CKBBalance;
    tokens: TokenAmount[];
    nfts: Nft[];
    dao: DAOBalance;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class WalletService {
    private readonly connection: ConnectionService;
    private readonly transactionService: TransactionService;
    private readonly ckbService: CKBService;
    private readonly tokenService: TokenService;
    private readonly daoService: DAOService;
    private readonly nftService: NftService;
    private readonly accountPublicKey: AccountExtendedPublicKey;
    private readonly addressType = AddressType.Receiving;
    private readonly logger = new Logger(WalletService.name);
    private addressMap = new Map<string, string>();

    constructor(connectionService: ConnectionService, mnemo: string) {
        this.connection = connectionService;
        this.transactionService = new TransactionService(this.connection);
        this.ckbService = new CKBService(this.connection, this.transactionService);
        this.tokenService = new TokenService(this.connection, this.transactionService);
        this.daoService = new DAOService(this.connection, this.transactionService);
        this.nftService = new NftService(this.connection);

        this.accountPublicKey = WalletService.getPrivateKeyFromMnemonic(mnemo).toAccountExtendedPublicKey();
    }

    static createNewMnemonic() {
        return mnemonic.generateMnemonic();
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

    async getBalance(accountId = 0): Promise<Balance> {
        const address = this.getAddress(accountId);
        const ckb = await this.ckbService.getBalance(address);
        const tokens = await this.tokenService.getBalance(address);
        const nfts = await this.nftService.getBalance(address);
        const dao = await this.daoService.getBalance(address);

        return { ckb, tokens, dao, nfts };
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

    async getCKBBalance(accountId = 0): Promise<CKBBalance> {
        const address = this.getAddress(accountId);
        return this.ckbService.getBalance(address);
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

    async getTokensBalance(accountId = 0): Promise<TokenAmount[]> {
        const address = this.getAddress(accountId);
        return this.tokenService.getBalance(address);
    }

    // -----------------------------
    // -- Token service functions --
    // -----------------------------

    async getNftsBalance(accountId = 0): Promise<Nft[]> {
        const address = this.getAddress(accountId);
        return this.nftService.getBalance(address);
    }

    // ---------------------------
    // -- DAO Service functions --
    // ---------------------------
    async depositInDAO(amount: bigint, mnemo: string, accountId = 0): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);

        return this.daoService.deposit(amount, address, address, privateKey);
    }

    async withdrawAndUnlockFromCell(cell: Cell, mnemo: string, accountId = 0): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);
        if (!this.daoService.isCellDeposit(cell)) {
            this.logger.warn("Cell already withrawed. Unlocking...");
            return this.daoService.unlock(cell, privateKey, address, address);
        }
        if (!(await this.daoService.isCellUnlockable(cell))) {
            throw new Error("Cell can not be unlocked. Minimum time is 30 days.");
        }

        const withdrawTxHash = await this.daoService.withdraw(cell, privateKey, address);
        let commited = false;
        let transaction: TransactionWithStatus;

        // Should be done in a queue
        while (!commited) {
            transaction = await this.connection.getTransactionFromHash(withdrawTxHash, false);
            commited = transaction.tx_status.block_hash && transaction.tx_status.status === TransactionStatus.COMMITTED;

            if (!commited) {
                await sleep(1000);
            }
        }

        // Search new withdraw cell to unlock
        const withdrawCell = await this.daoService.getWithdrawCellFromCapacityTx(cell.cell_output.capacity, address, withdrawTxHash);
        return this.daoService.unlock(withdrawCell, privateKey, address, address);
    }

    async withdrawAndUnlock(unlockableAmount: DAOUnlockableAmount, mnemo: string, accountId = 0): Promise<string> {
        const address = this.getAddress(accountId);

        if (unlockableAmount.type === "total") {
            const cells = await this.daoService.getCells(address);

            for (let i = 0; i < cells.length; i += 1) {
                await this.withdrawAndUnlockFromCell(cells[i], mnemo, accountId);
            }

            return "All amount unlocked sucessfully";
        }

        const cell = await this.daoService.findCellFromUnlockableAmount(unlockableAmount, address);
        return this.withdrawAndUnlockFromCell(cell, mnemo, accountId);
    }

    async getDAOStatistics(accountId = 0): Promise<DAOStatistics> {
        const address = this.getAddress(accountId);
        return this.daoService.getStatistics(address);
    }

    async getDAOBalance(accountId = 0): Promise<DAOBalance> {
        const address = this.getAddress(accountId);
        return this.daoService.getBalance(address);
    }

    async getDAOUnlockableAmounts(accountId = 0): Promise<DAOUnlockableAmount[]> {
        const address = this.getAddress(accountId);
        return this.daoService.getUnlockableAmounts(address);
    }
}
