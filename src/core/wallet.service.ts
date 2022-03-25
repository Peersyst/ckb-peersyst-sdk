import { mnemonic, ExtendedPrivateKey, AccountExtendedPublicKey, AddressType } from "@ckb-lumos/hd";
import { ConnectionService } from "./connection.service";
import { TransactionService, Transaction, TransactionStatus, FeeRate } from "./transaction.service";
import { TokenService, TokenAmount } from "./assets/token.service";
import { CKBBalance, CKBService } from "./assets/ckb.service";
import { DAOBalance, DAOService, DAOStatistics, DAOUnlockableAmount } from "./dao/dao.service";
import { Cell, Script } from "@ckb-lumos/lumos";
import { TransactionWithStatus, QueryOptions } from "@ckb-lumos/base";
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
    private firstIndexWithoutTxs = 0;
    private lastHashBlock: string;
    private accountCellsMap = new Map<number, Cell[]>();
    private accountTransactionMap = new Map<number, Transaction[]>();

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

    private static getPrivateKeyFromMnemonic(mnemo: string): ExtendedPrivateKey {
        const seed = mnemonic.mnemonicToSeedSync(mnemo);
        return ExtendedPrivateKey.fromSeed(seed);
    }

    // ----------------------
    // -- Wallet functions --
    // ----------------------
    async refreshCellsAndTransactions() {
        let currentIndex = 0;
        let found = true;
        let toBlock: string;
        let fromBlock: string;
        const currentBlock = await this.connection.getCurrentBlockHeader();

        if (!this.lastHashBlock) {
            toBlock = currentBlock.number;
        } else {
            fromBlock = this.lastHashBlock;
            toBlock = currentBlock.number;
        }

        const cellProvider = this.connection.getCellProvider({ toBlock });

        while (currentIndex < this.firstIndexWithoutTxs || found) {
            found = false;
            const index = currentIndex < this.firstIndexWithoutTxs ? currentIndex : this.firstIndexWithoutTxs;
            const address = this.getAddress(index);
            const transactions = await this.transactionService.getTransactions(address, toBlock, fromBlock);

            if (transactions.length > 0) {
                // Update transactions
                const currentTxs: Transaction[] = this.accountTransactionMap.get(index) || [];
                this.accountTransactionMap.set(index, currentTxs.concat(transactions));

                // Update cells
                const collectorOptions: QueryOptions = { lock: this.getLock(index), toBlock };
                if (fromBlock) {
                    collectorOptions.fromBlock = fromBlock;
                }
                const cellCollector = cellProvider.collector(collectorOptions);
                const cells: Cell[] = this.accountCellsMap.get(index) || [];
                for await (const cell of cellCollector.collect()) {
                    cells.push(cell);
                }
                this.accountCellsMap.set(index, cells);

                // Update indexes
                if (index === this.firstIndexWithoutTxs) {
                    this.firstIndexWithoutTxs += 1;
                }
                found = true;
            }
            if (index === currentIndex && index !== this.firstIndexWithoutTxs) {
                currentIndex += 1;
            }
        }

        this.lastHashBlock = currentBlock.number;
    }

    getCells(): Cell[] {
        return [...this.accountCellsMap.values()].flat(1);
    }

    getNewAddress(): string {
        this.firstIndexWithoutTxs += 1;
        return this.getAddress(this.firstIndexWithoutTxs - 1);
    }

    getAccountIndexes(): number[] {
        return [...Array(this.firstIndexWithoutTxs).keys()];
    }

    getLock(accountId = 0, script: AddressScriptType = AddressScriptType.SECP256K1_BLAKE160): Script {
        const template = this.connection.getConfig().SCRIPTS[script];
        const lockScript = {
            code_hash: template.CODE_HASH,
            hash_type: template.HASH_TYPE,
            args: this.accountPublicKey.publicKeyInfo(this.addressType, accountId).blake160,
        };

        return lockScript;
    }

    getAddress(accountId = 0, script: AddressScriptType = AddressScriptType.SECP256K1_BLAKE160): string {
        const key = `${accountId}-${script}`;
        if (!this.addressMap.has(key)) {
            const address = this.connection.getAddressFromLock(this.getLock(accountId, script));
            this.addressMap.set(key, address);
        }

        return this.addressMap.get(key);
    }

    getAllAddresses(): string[] {
        const addresses = [];
        for (let i = 0; i < this.firstIndexWithoutTxs; i += 1) {
            addresses.push(this.getAddress(i));
        }

        return addresses;
    }

    getAllPrivateKeys(mnemo: string): string[] {
        const extPrivateKey = WalletService.getPrivateKeyFromMnemonic(mnemo);
        const privateKeys = [];
        for (let i = 0; i < this.firstIndexWithoutTxs; i += 1) {
            privateKeys.push(extPrivateKey.privateKeyInfo(this.addressType, i).privateKey);
        }

        return privateKeys;
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

    getAddressAndPrivKeyFromLock(mnemo: string, lock: Script): { address: string; privateKey: string } {
        const address = this.connection.getAddressFromLock(lock);
        const extPrivateKey = WalletService.getPrivateKeyFromMnemonic(mnemo);
        const addresses = this.getAllAddresses();
        const privateKey = extPrivateKey.privateKeyInfo(this.addressType, addresses.indexOf(address)).privateKey;

        return { address, privateKey };
    }

    async getBalanceFromAccount(accountId = 0): Promise<Balance> {
        const address = this.getAddress(accountId);
        const ckb = await this.ckbService.getBalance(address);
        const tokens = await this.tokenService.getBalance(address);
        const nfts = await this.nftService.getBalance(address);
        const dao = await this.daoService.getBalance(address);

        return { ckb, tokens, dao, nfts };
    }

    async getBalance(): Promise<Balance> {
        const cells = this.getCells();
        const ckb = this.ckbService.getBalanceFromCells(cells);
        const tokens = await this.tokenService.getBalanceFromCells(cells);
        const nfts = await this.nftService.getBalanceFromCells(cells);
        const dao = await this.daoService.getBalanceFromCells(cells);

        return { ckb, tokens, dao, nfts };
    }

    // -----------------------------------
    // -- Transaction service functions --
    // -----------------------------------
    async getTransactionsFromAccount(accountId = 0): Promise<Transaction[]> {
        const address = this.getAddress(accountId);

        return this.transactionService.getTransactions(address);
    }

    async getTransactions(): Promise<Transaction[]> {
        this.refreshCellsAndTransactions();

        return [...this.accountTransactionMap.values()].flat(1);
    }

    // ---------------------------
    // -- CKB service functions --
    // ---------------------------
    async sendTransactionSingleAccount(
        amount: bigint,
        mnemo: string,
        to: string,
        accountId: number,
        feeRate: FeeRate = FeeRate.NORMAL,
    ): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);
        await this.refreshCellsAndTransactions();

        return this.ckbService.transfer(address, to, BigInt(amount), privateKey, feeRate);
    }

    async sendTransaction(amount: bigint, mnemo: string, to: string, feeRate: FeeRate = FeeRate.NORMAL): Promise<string> {
        await this.refreshCellsAndTransactions();
        const addresses = this.getAllAddresses();
        const privateKeys = this.getAllPrivateKeys(mnemo);

        return this.ckbService.transferFromCells(this.getCells(), addresses, to, BigInt(amount), privateKeys, feeRate);
    }

    async getCKBBalanceFromAccount(accountId = 0): Promise<CKBBalance> {
        const address = this.getAddress(accountId);
        return this.ckbService.getBalance(address);
    }

    async getCKBBalance(): Promise<CKBBalance> {
        return this.ckbService.getBalanceFromCells(this.getCells());
    }

    // -----------------------------
    // -- Token service functions --
    // -----------------------------
    // Deprecated in accounts
    async issueTokens(amount: number, mnemo: string, accountId = 0, feeRate: FeeRate = FeeRate.NORMAL): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);

        return this.tokenService.issue(address, amount, privateKey, feeRate);
    }

    // Deprecated in accounts
    async transferTokens(
        amount: number,
        mnemo: string,
        to: string,
        token: string,
        accountId = 0,
        feeRate: FeeRate = FeeRate.NORMAL,
    ): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);

        return this.tokenService.transfer(address, to, token, amount, privateKey, feeRate);
    }

    async getTokensBalanceFromAccount(accountId = 0): Promise<TokenAmount[]> {
        const address = this.getAddress(accountId);
        return this.tokenService.getBalance(address);
    }

    async getTokensBalance(): Promise<TokenAmount[]> {
        return this.tokenService.getBalanceFromCells(this.getCells());
    }

    // -----------------------------
    // -- Nft service functions --
    // -----------------------------

    async getNftsBalanceFromAccount(accountId = 0): Promise<Nft[]> {
        const address = this.getAddress(accountId);
        return this.nftService.getBalance(address);
    }

    async getNftsBalance(): Promise<Nft[]> {
        return this.nftService.getBalanceFromCells(this.getCells());
    }

    // ---------------------------
    // -- DAO service functions --
    // ---------------------------
    async depositInDAOSingleAccount(amount: bigint, mnemo: string, accountId = 0, feeRate: FeeRate = FeeRate.NORMAL): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivateKey(mnemo, accountId);
        return this.daoService.deposit(amount, address, address, privateKey, feeRate);
    }

    async depositInDAO(amount: bigint, mnemo: string, feeRate: FeeRate = FeeRate.NORMAL): Promise<string> {
        await this.refreshCellsAndTransactions();
        const addresses = this.getAllAddresses();
        const privateKeys = this.getAllPrivateKeys(mnemo);

        return this.daoService.depositMultiAccount(amount, this.getCells(), addresses, this.getNewAddress(), privateKeys, feeRate);
    }

    async withdrawAndUnlockFromCell(cell: Cell, mnemo: string, feeRate: FeeRate = FeeRate.NORMAL): Promise<string> {
        const { address, privateKey } = this.getAddressAndPrivKeyFromLock(mnemo, cell.cell_output.lock);
        const feeAddresses = this.getAllAddresses();
        const privateKeys = this.getAllPrivateKeys(mnemo);
        const to = this.getNewAddress();
        if (!this.daoService.isCellDeposit(cell)) {
            this.logger.warn("Cell already withrawed. Unlocking...");
            return this.daoService.unlock(cell, privateKey, address, to, feeAddresses, privateKeys, feeRate);
        }
        if (!(await this.daoService.isCellUnlockable(cell))) {
            throw new Error("Cell can not be unlocked. Minimum time is 30 days.");
        }

        const withdrawTxHash = await this.daoService.withdraw(cell, privateKey, feeAddresses, privateKeys, feeRate);
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
        return this.daoService.unlock(withdrawCell, privateKey, address, to, feeAddresses, privateKeys, feeRate);
    }

    async withdrawAndUnlock(unlockableAmount: DAOUnlockableAmount, mnemo: string): Promise<string> {
        await this.refreshCellsAndTransactions();
        const cells = await this.daoService.filterDAOCells(this.getCells());

        if (unlockableAmount.type === "total") {
            for (let i = 0; i < cells.length; i += 1) {
                try {
                    await this.withdrawAndUnlockFromCell(cells[i], mnemo);
                } catch (err) {
                    this.logger.error(`Can not withdraw and unlock cell: ${cells[i]}\n\tError:${err.toString()}`);
                }
            }

            return "All amount unlocked sucessfully";
        }

        const cell = await this.daoService.findCellFromUnlockableAmountAndCells(unlockableAmount, cells);
        return this.withdrawAndUnlockFromCell(cell, mnemo);
    }

    async getDAOStatisticsFromAccount(accountId = 0): Promise<DAOStatistics> {
        const address = this.getAddress(accountId);
        return this.daoService.getStatistics(address);
    }

    async getDAOStatistics(): Promise<DAOStatistics> {
        return this.daoService.getStatisticsFromCells(this.getCells());
    }

    async getDAOBalanceFromAccount(accountId = 0): Promise<DAOBalance> {
        const address = this.getAddress(accountId);
        return this.daoService.getBalance(address);
    }

    async getDAOBalance(): Promise<DAOBalance> {
        return this.daoService.getBalanceFromCells(this.getCells());
    }

    async getDAOUnlockableAmountsFromAccount(accountId = 0): Promise<DAOUnlockableAmount[]> {
        const address = this.getAddress(accountId);
        return this.daoService.getUnlockableAmounts(address);
    }

    async getDAOUnlockableAmounts(): Promise<DAOUnlockableAmount[]> {
        return this.daoService.getUnlockableAmountsFromCells(this.getCells());
    }
}
