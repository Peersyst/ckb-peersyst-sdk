import * as fs from "fs";
import { fromJS } from "immutable";
import { Cell, CellDep, Hash, HexString, PackedSince } from "@ckb-lumos/base";
import { List, Map, Record } from "immutable";
import { TransactionSkeletonInterface } from "@ckb-lumos/helpers";

const TransactionSkeletonRecord = Record<TransactionSkeletonInterface>({
    cellProvider: null,
    cellDeps: List<CellDep>(),
    headerDeps: List<Hash>(),
    inputs: List<Cell>(),
    outputs: List<Cell>(),
    witnesses: List<HexString>(),
    fixedEntries: List<{ field: string; index: number }>(),
    signingEntries: List<{ type: string; index: number; message: string }>(),
    inputSinces: Map<number, PackedSince>(),
});

const TransactionSkeletonTypeReviver = (key: string, value: any) => {
    if (key === "") return TransactionSkeletonRecord(value);
    else if (key === "cellProvider") return value;
    else if (key === "cellDeps") return List<CellDep>(value);
    else if (key === "headerDeps") return List<Hash>(value);
    else if (key === "inputs" || key === "outputs") return List<Cell>(value);
    else if (key === "witnesses") return List<HexString>(value);
    else if (key === "fixedEntries") return List<{ field: string; index: number }>(value);
    else if (key === "signingEntries") return List<{ type: string; index: number; message: string }>(value);
    else if (key === "inputSinces") return Map<number, PackedSince>(value);
};

export const jsonToTransactionSkeletonInterface = (json: object) => {
    return fromJS(json, TransactionSkeletonTypeReviver);
};
