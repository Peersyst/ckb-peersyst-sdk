import { Cell, Script } from "@ckb-lumos/lumos";
import { TransactionSkeleton } from "@ckb-lumos/helpers";
import { dao, common } from "@ckb-lumos/common-scripts";
import { ConnectionService } from "./connection.service";
import { TransactionService } from "./transaction.service";

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
}

export enum DAOCellType {
    DEPOSIT = "deposit",
    WITHDRAW = "withdraw",
    ALL = "all",
}

export class DAOService {
    private readonly connection: ConnectionService;
    private readonly transactionService: TransactionService;
    private readonly daoCellSize = BigInt(102 * 10 ** 8);
    private readonly daoScriptArgs = "0x";
    private readonly depositDaoData = "0x0000000000000000";
    private readonly unlockMinTime = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

    constructor(connectionService: ConnectionService, transactionService: TransactionService) {
        this.connection = connectionService;
        this.transactionService = transactionService;
    }

    async getCells(address: string, cellType: DAOCellType = DAOCellType.ALL): Promise<Cell[]> {
        const cells = [];
        const daoConfig = this.connection.getConfig().SCRIPTS.DAO;
        const daoScript: Script = { code_hash: daoConfig.CODE_HASH, hash_type: daoConfig.HASH_TYPE, args: this.daoScriptArgs };
        const data = cellType === DAOCellType.DEPOSIT ? this.depositDaoData : "any";

        const collector = this.connection.getIndexer().collector({
            lock: this.connection.getLockFromAddress(address),
            type: daoScript,
            data,
        });

        for await (const inputCell of collector.collect()) {
            if (cellType === DAOCellType.WITHDRAW && inputCell.data === this.depositDaoData) {
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

    async getBalance(address: string): Promise<DAOBalance> {
        const cells = await this.getCells(address, DAOCellType.ALL);
        let daoDeposit = BigInt(0);
        let daoCompensation = BigInt(0);

        for (let i = 0; i < cells.length; i += 1) {
            let maxWithdraw = BigInt(0);
            daoDeposit += BigInt(cells[i].cell_output.capacity);

            if (cells[i].data === this.depositDaoData) {
                maxWithdraw = await this.getDepositCellMaximumWithdraw(cells[i]);
            } else {
                maxWithdraw = await this.getWithdrawCellMaximumWithdraw(cells[i]);
            }

            daoCompensation += maxWithdraw - BigInt(cells[i].cell_output.capacity);
        }

        return { daoDeposit, daoCompensation };
    }

    async deposit(amount: bigint, from: string, to: string, privateKey: string): Promise<string> {
        if (amount < this.daoCellSize) {
            throw new Error("Minimum deposit value is 102 CKB");
        }

        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getIndexer() });
        txSkeleton = await dao.deposit(txSkeleton, from, to, amount, this.connection.getConfigAsObject());
        txSkeleton = await common.payFee(txSkeleton, [from], this.transactionService.defaultFee, null, this.connection.getConfigAsObject());

        return this.transactionService.signTransaction(txSkeleton, privateKey);
    }

    async withdraw(inputCell: Cell, privateKey: string, feeAddress: string): Promise<string> {
        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getIndexer() });
        txSkeleton = await dao.withdraw(txSkeleton, inputCell, null, this.connection.getConfigAsObject());
        txSkeleton = await common.payFee(
            txSkeleton,
            [feeAddress],
            this.transactionService.defaultFee,
            null,
            this.connection.getConfigAsObject(),
        );

        return this.transactionService.signTransaction(txSkeleton, privateKey);
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

    async unlock(withdrawCell: Cell, privateKey: string, from: string, to: string): Promise<string> {
        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getIndexer() });
        const depositCell = await this.getDepositCellFromWithdrawCell(withdrawCell);
        const depositHeader = await this.connection.getBlockHeaderFromHash(depositCell.block_hash);
        if (parseInt(depositHeader.timestamp, 16) + this.unlockMinTime > Date.now()) {
            throw new Error("Cell can not be unlocked. Minimum time is 30 days.");
        }

        txSkeleton = await dao.unlock(txSkeleton, depositCell, withdrawCell, to, from, this.connection.getConfigAsObject());
        txSkeleton = await common.payFee(txSkeleton, [from], this.transactionService.defaultFee, null, this.connection.getConfigAsObject());

        return this.transactionService.signTransaction(txSkeleton, privateKey);
    }

    async getStatistics(address: string): Promise<DAOStatistics> {
        const statistics: DAOStatistics = { maximumWithdraw: BigInt(0), daoEarliestSince: null };

        const cells = await this.getCells(address, DAOCellType.ALL);
        for (let i = 0; i < cells.length; i += 1) {
            if (cells[i].data === this.depositDaoData) {
                const maxWithdraw = await this.getDepositCellMaximumWithdraw(cells[i]);
                statistics.maximumWithdraw += maxWithdraw;
                const earliestSince = await this.getDepositDaoEarliestSince(cells[i]);
                if (!statistics.daoEarliestSince || statistics.daoEarliestSince > earliestSince) {
                    statistics.daoEarliestSince = earliestSince;
                }
            } else {
                const maxWithdraw = await this.getWithdrawCellMaximumWithdraw(cells[i]);
                statistics.maximumWithdraw += maxWithdraw;
                const earliestSince = await this.getWithdrawDaoEarliestSince(cells[i]);
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
        const unlockableAmounts: DAOUnlockableAmount[] = [];
        const cells = await this.getCells(address);

        let totalAmount = BigInt(0);
        let totalCompensation = BigInt(0);
        let maxUnlockableDate = new Date();
        let unlockable = true;

        for (let i = 0; i < cells.length; i += 1) {
            const unlockableAmount: DAOUnlockableAmount = {
                amount: BigInt(cells[i].cell_output.capacity),
                compensation: BigInt(0),
                unlockable: true,
                unlockableDate: new Date(),
                type: "single",
            };
            let maxWithdraw = BigInt(0);
            let timestamp: number;

            if (cells[i].data === this.depositDaoData) {
                maxWithdraw = await this.getDepositCellMaximumWithdraw(cells[i]);
                const blockHeader = await this.connection.getBlockHeaderFromNumber(cells[i].block_number);
                timestamp = parseInt(blockHeader.timestamp, 16);
            } else {
                maxWithdraw = await this.getWithdrawCellMaximumWithdraw(cells[i]);
                const { txHash } = await this.findCorrectInputFromWithdrawCell(cells[i]);
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
        });

        return unlockableAmounts;
    }
}
