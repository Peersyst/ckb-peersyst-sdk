import { Cell } from "@ckb-lumos/lumos";
import { TransactionSkeleton } from "@ckb-lumos/helpers";
import { dao, common } from "@ckb-lumos/common-scripts";
import { ConnectionService } from "./connection.service";
import { TransactionService } from "./transaction.service";

export interface DAOStatistics {
    maximumWithdraw: bigint;
    daoEarliestSince: bigint;
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

    constructor(connectionService: ConnectionService, transactionService: TransactionService) {
        this.connection = connectionService;
        this.transactionService = transactionService;
    }

    async getCells(address: string, type: DAOCellType = DAOCellType.ALL) {
        const cells = [];
        const daoDepositedCellCollector = new dao.CellCollector(address, this.connection.getIndexer(), type);

        for await (const inputCell of daoDepositedCellCollector.collect()) {
            if (!inputCell.block_hash && inputCell.block_number) {
                const header = await this.connection.getBlockHeaderFromNumber(inputCell.block_number);
                cells.push({ ...inputCell, block_hash: header.hash });
            } else {
                cells.push(inputCell);
            }
        }

        return cells;
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

    async getDepositCellFromWithdraw(withdrawCell: Cell): Promise<Cell> {
        return withdrawCell;
    }

    async unlock(withdrawCell: Cell, privateKey: string, from: string, to: string): Promise<string> {
        let txSkeleton = TransactionSkeleton({ cellProvider: this.connection.getIndexer() });
        const depositCell = await this.getDepositCellFromWithdraw(withdrawCell);

        txSkeleton = await dao.unlock(txSkeleton, depositCell, withdrawCell, to, from, this.connection.getConfigAsObject());
        txSkeleton = await common.payFee(txSkeleton, [from], this.transactionService.defaultFee, null, this.connection.getConfigAsObject());

        return this.transactionService.signTransaction(txSkeleton, privateKey);
    }

    async getStatistics(address: string): Promise<DAOStatistics> {
        const statistics: DAOStatistics = { maximumWithdraw: BigInt(0), daoEarliestSince: null };

        const depositCells = await this.getCells(address, DAOCellType.DEPOSIT);
        for (let i = 0; i < depositCells.length; i += 1) {
            const maxWithdraw = await this.getDepositCellMaximumWithdraw(depositCells[i]);
            statistics.maximumWithdraw += maxWithdraw;
            const earliestSince = await this.getDepositDaoEarliestSince(depositCells[i]);
            if (!statistics.daoEarliestSince || statistics.daoEarliestSince > earliestSince) {
                statistics.daoEarliestSince = earliestSince;
            }
        }

        const withdrawCells = await this.getCells(address, DAOCellType.WITHDRAW);
        for (let i = 0; i < withdrawCells.length; i += 1) {
            const maxWithdraw = await this.getWithdrawCellMaximumWithdraw(withdrawCells[i]);
            statistics.maximumWithdraw += maxWithdraw;
            const earliestSince = await this.getWithdrawDaoEarliestSince(withdrawCells[i]);
            if (!statistics.daoEarliestSince || statistics.daoEarliestSince > earliestSince) {
                statistics.daoEarliestSince = earliestSince;
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
        const transaction = await this.connection.getTransactionFromHash(withdrawCell.out_point.tx_hash);
        // TODO: find input cell, maybe create function
        const depositTxHash = transaction.transaction.inputs[0].previous_output.tx_hash;
        const depositTransaction = await this.connection.getTransactionFromHash(depositTxHash);
        const depositBlockHeader = await this.connection.getBlockHeaderFromHash(depositTransaction.tx_status.block_hash);

        return dao.calculateMaximumWithdraw(withdrawCell, depositBlockHeader.dao, withdrawBlockHeader.dao);
    }

    async getWithdrawDaoEarliestSince(withdrawCell: Cell): Promise<bigint> {
        const withdrawBlockHeader = await this.connection.getBlockHeaderFromHash(withdrawCell.block_hash);
        const transaction = await this.connection.getTransactionFromHash(withdrawCell.out_point.tx_hash);
        const depositTxHash = transaction.transaction.inputs[0].previous_output.tx_hash;
        const depositTransaction = await this.connection.getTransactionFromHash(depositTxHash);
        const depositBlockHeader = await this.connection.getBlockHeaderFromHash(depositTransaction.tx_status.block_hash);

        return dao.calculateDaoEarliestSince(depositBlockHeader.epoch, withdrawBlockHeader.epoch);
    }

    async getDepositDaoEarliestSince(depositCell: Cell): Promise<bigint> {
        const depositBlockHeader = await this.connection.getBlockHeaderFromHash(depositCell.block_hash);
        const withdrawBlockHeader = await this.connection.getCurrentBlockHeader();

        return dao.calculateDaoEarliestSince(depositBlockHeader.epoch, withdrawBlockHeader.epoch);
    }
}
