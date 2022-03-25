import { Cell, Script } from "@ckb-lumos/lumos";
import { TransactionSkeleton, TransactionSkeletonType } from "@ckb-lumos/helpers";
import { dao, common } from "@ckb-lumos/common-scripts";
import { ConnectionService } from "../connection.service";
import { FeeRate, TransactionService } from "../transaction.service";
import { Logger } from "../../utils/logger";

export interface DAOStatistics {
    maximumWithdraw: bigint;
    daoEarliestSince: bigint;
}

export interface DAOBalance {
    daoDeposit: bigint;
    daoCompensation: bigint;
}

export interface DAOUnlockableAmount {
    type: "total" | "single";
    amount: bigint;
    compensation: bigint;
    unlockable: boolean;
    unlockableDate: Date;
    txHash: string;
}

export enum DAOCellType {
    DEPOSIT = "deposit",
    WITHDRAW = "withdraw",
    ALL = "all",
}

export class DAOService {
    private readonly connection: ConnectionService;
    private readonly transactionService: TransactionService;
    private readonly logger = new Logger(DAOService.name);
    private readonly daoCellSize = BigInt(102 * 10 ** 8);
    private readonly daoScriptArgs = "0x";
    private readonly depositDaoData = "0x0000000000000000";
    private readonly unlockMinTime = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    constructor(connectionService: ConnectionService, transactionService: TransactionService) {
        this.connection = connectionService;
        this.transactionService = transactionService;
    }

    private getDAOScript(): Script {
        const daoConfig = this.connection.getConfig().SCRIPTS.DAO;

        return {
            code_hash: daoConfig.CODE_HASH,
            hash_type: daoConfig.HASH_TYPE,
            args: this.daoScriptArgs,
        };
    }

    private isCellDAO(cell: Cell): boolean {
        const daoScript = this.getDAOScript();
        if (!cell.cell_output.type) {
            return false;
        }
        const { code_hash, hash_type, args } = cell.cell_output.type;

        return code_hash === daoScript.code_hash && hash_type === daoScript.hash_type && args === daoScript.args;
    }

    private addDAOCellDep(txSkeleton: TransactionSkeletonType): TransactionSkeletonType {
        const template = this.connection.getConfig().SCRIPTS.DAO;
        return TransactionService.addCellDep(txSkeleton, template);
    }

    isCellDeposit(cell: Cell): boolean {
        return cell.data === this.depositDaoData;
    }

    async isCellUnlockable(cell: Cell): Promise<boolean> {
        let depositBlockHash: string;

        if (this.isCellDeposit(cell)) {
            depositBlockHash = cell.block_hash;
        } else {
            const depositCell = await this.getDepositCellFromWithdrawCell(cell);
            depositBlockHash = depositCell.block_hash;
        }
        const depositHeader = await this.connection.getBlockHeaderFromHash(depositBlockHash);

        return parseInt(depositHeader.timestamp, 16) + this.unlockMinTime < Date.now();
    }

    async getCells(address: string, cellType: DAOCellType = DAOCellType.ALL): Promise<Cell[]> {
        const cells = [];
        const daoScript = this.getDAOScript();
        const data = cellType === DAOCellType.DEPOSIT ? this.depositDaoData : "any";

        const collector = this.connection.getIndexer().collector({
            lock: this.connection.getLockFromAddress(address),
            type: daoScript,
            data,
        });

        for await (const inputCell of collector.collect()) {
            if (cellType === DAOCellType.WITHDRAW && this.isCellDeposit(inputCell)) {
                continue;
            }

            if (!inputCell.block_hash && inputCell.block_number) {
                const header = await this.connection.getBlockHeaderFromNumber(inputCell.block_number);
                cells.push({ ...inputCell, block_hash: header.hash });
            } else {
                cells.push(inputCell);
            }
        }

        return cells;
    }

    async filterDAOCells(cells: Cell[], cellType: DAOCellType = DAOCellType.ALL): Promise<Cell[]> {
        const filteredCells: Cell[] = [];
        for (const cell of cells) {
            if (this.isCellDAO(cell)) {
                if (
                    (cellType === DAOCellType.WITHDRAW && this.isCellDeposit(cell)) ||
                    (cellType === DAOCellType.DEPOSIT && !this.isCellDeposit(cell))
                ) {
                    continue;
                }

                if (!cell.block_hash && cell.block_number) {
                    const header = await this.connection.getBlockHeaderFromNumber(cell.block_number);
                    filteredCells.push({ ...cell, block_hash: header.hash });
                } else {
                    filteredCells.push(cell);
                }
            }
        }

        return filteredCells;
    }

    async getBalance(address: string): Promise<DAOBalance> {
        const cells = await this.getCells(address, DAOCellType.ALL);
        let daoDeposit = BigInt(0);
        let daoCompensation = BigInt(0);

        for (let i = 0; i < cells.length; i += 1) {
            let maxWithdraw = BigInt(0);
            daoDeposit += BigInt(cells[i].cell_output.capacity);

            if (this.isCellDeposit(cells[i])) {
                maxWithdraw = await this.getDepositCellMaximumWithdraw(cells[i]);
            } else {
                maxWithdraw = await this.getWithdrawCellMaximumWithdraw(cells[i]);
            }

            daoCompensation += maxWithdraw - BigInt(cells[i].cell_output.capacity);
        }

        return { daoDeposit, daoCompensation };
    }

    async getBalanceFromCells(cells: Cell[]): Promise<DAOBalance> {
        const daoCells = await this.filterDAOCells(cells, DAOCellType.ALL);
        let daoDeposit = BigInt(0);
        let daoCompensation = BigInt(0);

        for (let i = 0; i < daoCells.length; i += 1) {
            let maxWithdraw = BigInt(0);
            daoDeposit += BigInt(daoCells[i].cell_output.capacity);

            if (this.isCellDeposit(daoCells[i])) {
                maxWithdraw = await this.getDepositCellMaximumWithdraw(daoCells[i]);
            } else {
                maxWithdraw = await this.getWithdrawCellMaximumWithdraw(daoCells[i]);
            }

            daoCompensation += maxWithdraw - BigInt(daoCells[i].cell_output.capacity);
        }

        return { daoDeposit, daoCompensation };
    }

    async deposit(amount: bigint, from: string, to: string, privateKey: string, feeRate: FeeRate = FeeRate.NORMAL): Promise<string> {
        if (amount < this.daoCellSize) {
            throw new Error("Minimum deposit value is 102 CKB");
        }

        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getEmptyCellProvider() });
        txSkeleton = await dao.deposit(txSkeleton, from, to, amount, this.connection.getConfigAsObject());
        txSkeleton = await common.payFeeByFeeRate(txSkeleton, [from], feeRate, null, this.connection.getConfigAsObject());

        return this.transactionService.signTransaction(txSkeleton, [privateKey]);
    }

    async depositMultiAccount(
        amount: bigint,
        cells: Cell[],
        fromAddresses: string[],
        to: string,
        privateKeys: string[],
        feeRate: FeeRate = FeeRate.NORMAL,
    ): Promise<string> {
        if (amount < this.daoCellSize) {
            throw new Error("Minimum deposit value is 102 CKB");
        }

        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getEmptyCellProvider() });
        txSkeleton = this.addDAOCellDep(txSkeleton);

        // Add output
        const toScript = this.connection.getLockFromAddress(to);
        txSkeleton = txSkeleton.update("outputs", (outputs) => {
            return outputs.push({
                cell_output: {
                    capacity: "0x" + amount.toString(16),
                    lock: toScript,
                    type: this.getDAOScript(),
                },
                data: this.depositDaoData,
            });
        });
        const outputIndex = txSkeleton.get("outputs").size - 1;

        // Fix output entry
        txSkeleton = txSkeleton.update("fixedEntries", (fixedEntries) => {
            return fixedEntries.push({
                field: "outputs",
                index: outputIndex,
            });
        });

        // Inject capacity
        txSkeleton = this.transactionService.addSecp256CellDep(txSkeleton);
        txSkeleton = this.transactionService.injectCapacity(txSkeleton, amount, cells);

        // Pay fee
        txSkeleton = await common.payFeeByFeeRate(txSkeleton, fromAddresses, feeRate, null, this.connection.getConfigAsObject());

        // Get signing private keys
        const signingPrivKeys = this.transactionService.extractPrivateKeys(txSkeleton, fromAddresses, privateKeys);

        return this.transactionService.signTransaction(txSkeleton, signingPrivKeys);
    }

    async withdraw(
        inputCell: Cell,
        privateKey: string,
        feeAddresses: string[],
        privateKeys: string[],
        feeRate: FeeRate = FeeRate.NORMAL,
    ): Promise<string> {
        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getEmptyCellProvider() });
        txSkeleton = await dao.withdraw(txSkeleton, inputCell, null, this.connection.getConfigAsObject());
        txSkeleton = await common.payFeeByFeeRate(txSkeleton, feeAddresses, feeRate, null, this.connection.getConfigAsObject());
        const signingPrivKeys = this.transactionService.extractPrivateKeys(txSkeleton, feeAddresses, privateKeys);
        const sortedSignPKeys = [privateKey, ...signingPrivKeys.filter((pkey) => pkey !== privateKey)];

        return this.transactionService.signTransaction(txSkeleton, sortedSignPKeys);
    }

    async unlock(
        withdrawCell: Cell,
        privateKey: string,
        from: string,
        to: string,
        feeAddresses: string[],
        privateKeys: string[],
        feeRate: FeeRate = FeeRate.NORMAL,
    ): Promise<string> {
        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getEmptyCellProvider() });
        const depositCell = await this.getDepositCellFromWithdrawCell(withdrawCell);
        if (!(await this.isCellUnlockable(depositCell))) {
            throw new Error("Cell can not be unlocked. Minimum time is 30 days.");
        }

        txSkeleton = await dao.unlock(txSkeleton, depositCell, withdrawCell, to, from, this.connection.getConfigAsObject());
        txSkeleton = await common.payFeeByFeeRate(txSkeleton, feeAddresses, feeRate, null, this.connection.getConfigAsObject());
        const signingPrivKeys = this.transactionService.extractPrivateKeys(txSkeleton, feeAddresses, privateKeys);
        const sortedSignPKeys = [privateKey, ...signingPrivKeys.filter((pkey) => pkey !== privateKey)];

        return this.transactionService.signTransaction(txSkeleton, sortedSignPKeys);
    }

    async findCorrectInputFromWithdrawCell(withdrawCell: Cell): Promise<{ index: string; txHash: string }> {
        const transaction = await this.connection.getTransactionFromHash(withdrawCell.out_point.tx_hash);

        let index: string;
        let txHash: string;
        for (let i = 0; i < transaction.transaction.inputs.length && !index; i += 1) {
            const prevOut = transaction.transaction.inputs[i].previous_output;

            const possibleTx = await this.connection.getTransactionFromHash(prevOut.tx_hash);
            const output = possibleTx.transaction.outputs[parseInt(prevOut.index, 16)];
            if (
                output.type &&
                output.capacity === withdrawCell.cell_output.capacity &&
                output.lock.args === withdrawCell.cell_output.lock.args &&
                output.lock.hash_type === withdrawCell.cell_output.lock.hash_type &&
                output.lock.code_hash === withdrawCell.cell_output.lock.code_hash &&
                output.type.args === withdrawCell.cell_output.type.args &&
                output.type.hash_type === withdrawCell.cell_output.type.hash_type &&
                output.type.code_hash === withdrawCell.cell_output.type.code_hash
            ) {
                index = prevOut.index;
                txHash = prevOut.tx_hash;
            }
        }

        return { index, txHash };
    }

    async findCellFromUnlockableAmount(unlockableAmount: DAOUnlockableAmount, address: string): Promise<Cell> {
        const cells = await this.getCells(address);
        return this.findCellFromUnlockableAmountAndCells(unlockableAmount, cells);
    }

    async findCellFromUnlockableAmountAndCells(unlockableAmount: DAOUnlockableAmount, cells: Cell[]): Promise<Cell> {
        const filtCells = await this.filterDAOCells(cells);
        const capacity = `0x${unlockableAmount.amount.toString(16)}`;

        for (let i = 0; i < filtCells.length; i += 1) {
            if (filtCells[i].cell_output.capacity === capacity && filtCells[i].out_point.tx_hash === unlockableAmount.txHash) {
                return filtCells[i];
            }
        }

        return null;
    }

    async getDepositCellFromWithdrawCell(withdrawCell: Cell): Promise<Cell> {
        const { index, txHash } = await this.findCorrectInputFromWithdrawCell(withdrawCell);
        const depositTransaction = await this.connection.getTransactionFromHash(txHash);
        const depositBlockHeader = await this.connection.getBlockHeaderFromHash(depositTransaction.tx_status.block_hash);

        return {
            cell_output: {
                capacity: withdrawCell.cell_output.capacity,
                lock: { ...withdrawCell.cell_output.lock },
                type: { ...withdrawCell.cell_output.type },
            },
            out_point: {
                tx_hash: txHash,
                index,
            },
            data: this.depositDaoData,
            block_hash: depositBlockHeader.hash,
            block_number: depositBlockHeader.number,
        };
    }

    async getWithdrawCellFromCapacityTx(capacity: string, address: string, txHash: string): Promise<Cell> {
        const cells = await this.getCells(address, DAOCellType.WITHDRAW);

        for (let i = 0; i < cells.length; i += 1) {
            if (cells[i].cell_output.capacity === capacity && cells[i].out_point.tx_hash === txHash) {
                return cells[i];
            }
        }

        return null;
    }

    async getStatistics(address: string): Promise<DAOStatistics> {
        const cells = await this.getCells(address, DAOCellType.ALL);

        return this.getStatisticsFromCells(cells);
    }

    async getStatisticsFromCells(cells: Cell[]): Promise<DAOStatistics> {
        const filtCells = await this.filterDAOCells(cells, DAOCellType.ALL);
        const statistics: DAOStatistics = { maximumWithdraw: BigInt(0), daoEarliestSince: null };

        for (let i = 0; i < filtCells.length; i += 1) {
            if (this.isCellDeposit(filtCells[i])) {
                const maxWithdraw = await this.getDepositCellMaximumWithdraw(filtCells[i]);
                statistics.maximumWithdraw += maxWithdraw;
                const earliestSince = await this.getDepositDaoEarliestSince(filtCells[i]);
                if (!statistics.daoEarliestSince || statistics.daoEarliestSince > earliestSince) {
                    statistics.daoEarliestSince = earliestSince;
                }
            } else {
                const maxWithdraw = await this.getWithdrawCellMaximumWithdraw(filtCells[i]);
                statistics.maximumWithdraw += maxWithdraw;
                const earliestSince = await this.getWithdrawDaoEarliestSince(filtCells[i]);
                if (!statistics.daoEarliestSince || statistics.daoEarliestSince > earliestSince) {
                    statistics.daoEarliestSince = earliestSince;
                }
            }
        }

        return statistics;
    }

    async getDepositCellMaximumWithdraw(depositCell: Cell): Promise<bigint> {
        const depositBlockHeader = await this.connection.getBlockHeaderFromHash(depositCell.block_hash);
        const withdrawBlockHeader = await this.connection.getCurrentBlockHeader();

        return dao.calculateMaximumWithdraw(depositCell, depositBlockHeader.dao, withdrawBlockHeader.dao);
    }

    async getWithdrawCellMaximumWithdraw(withdrawCell: Cell): Promise<bigint> {
        const withdrawBlockHeader = await this.connection.getBlockHeaderFromHash(withdrawCell.block_hash);
        const { txHash } = await this.findCorrectInputFromWithdrawCell(withdrawCell);
        const depositTransaction = await this.connection.getTransactionFromHash(txHash);
        const depositBlockHeader = await this.connection.getBlockHeaderFromHash(depositTransaction.tx_status.block_hash);

        return dao.calculateMaximumWithdraw(withdrawCell, depositBlockHeader.dao, withdrawBlockHeader.dao);
    }

    async getDepositDaoEarliestSince(depositCell: Cell): Promise<bigint> {
        const depositBlockHeader = await this.connection.getBlockHeaderFromHash(depositCell.block_hash);
        const withdrawBlockHeader = await this.connection.getCurrentBlockHeader();

        return dao.calculateDaoEarliestSince(depositBlockHeader.epoch, withdrawBlockHeader.epoch);
    }

    async getWithdrawDaoEarliestSince(withdrawCell: Cell): Promise<bigint> {
        const withdrawBlockHeader = await this.connection.getBlockHeaderFromHash(withdrawCell.block_hash);
        const { txHash } = await this.findCorrectInputFromWithdrawCell(withdrawCell);
        const depositTransaction = await this.connection.getTransactionFromHash(txHash);
        const depositBlockHeader = await this.connection.getBlockHeaderFromHash(depositTransaction.tx_status.block_hash);

        return dao.calculateDaoEarliestSince(depositBlockHeader.epoch, withdrawBlockHeader.epoch);
    }

    async getUnlockableAmounts(address: string): Promise<DAOUnlockableAmount[]> {
        const cells = await this.getCells(address);
        return this.getUnlockableAmountsFromCells(cells);
    }

    async getUnlockableAmountsFromCells(cells: Cell[]): Promise<DAOUnlockableAmount[]> {
        const unlockableAmounts: DAOUnlockableAmount[] = [];
        const filtCells = await this.filterDAOCells(cells);

        let totalAmount = BigInt(0);
        let totalCompensation = BigInt(0);
        let maxUnlockableDate = new Date();
        let unlockable = true;

        for (let i = 0; i < filtCells.length; i += 1) {
            const unlockableAmount: DAOUnlockableAmount = {
                amount: BigInt(filtCells[i].cell_output.capacity),
                compensation: BigInt(0),
                unlockable: true,
                unlockableDate: new Date(),
                type: "single",
                txHash: filtCells[i].out_point.tx_hash,
            };
            let maxWithdraw = BigInt(0);
            let timestamp: number;

            if (this.isCellDeposit(filtCells[i])) {
                maxWithdraw = await this.getDepositCellMaximumWithdraw(filtCells[i]);
                const blockHeader = await this.connection.getBlockHeaderFromNumber(filtCells[i].block_number);
                timestamp = parseInt(blockHeader.timestamp, 16);
            } else {
                maxWithdraw = await this.getWithdrawCellMaximumWithdraw(filtCells[i]);
                const { txHash } = await this.findCorrectInputFromWithdrawCell(filtCells[i]);
                const depositTransaction = await this.connection.getTransactionFromHash(txHash);
                const depositBlockHeader = await this.connection.getBlockHeaderFromHash(depositTransaction.tx_status.block_hash);
                timestamp = parseInt(depositBlockHeader.timestamp, 16);
            }

            unlockableAmount.compensation = maxWithdraw - unlockableAmount.amount;
            unlockableAmount.unlockableDate = new Date(timestamp + this.unlockMinTime);
            unlockableAmount.unlockable = timestamp + this.unlockMinTime < Date.now();
            unlockableAmounts.push(unlockableAmount);

            totalAmount += unlockableAmount.amount;
            totalCompensation += unlockableAmount.compensation;
            unlockable = unlockable && unlockableAmount.unlockable;
            if (maxUnlockableDate < unlockableAmount.unlockableDate) {
                maxUnlockableDate = unlockableAmount.unlockableDate;
            }
        }

        unlockableAmounts.push({
            amount: totalAmount,
            compensation: totalCompensation,
            unlockable,
            unlockableDate: maxUnlockableDate,
            type: "total",
            txHash: null,
        });

        return unlockableAmounts;
    }
}
