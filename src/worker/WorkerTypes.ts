export const ANY_PERK = "any perk";
export const NO_PERK = "";

export const CalcData = require('../../data/calc_data.json') as CalcDataType;

export interface WorkerCalcRequest {
    targetPerkNames: string[],
    targetPerkRanks: number[],
    targetGizmoType: GizmoType,
    targetGizmoAncient: boolean
}

export interface WorkerStatusReport {
    workerStatus: WorkStatus,
    percentComplete: number,
    result: GizmoResult[]
}

export interface GizmoResult {
    componentQuantities: any[][], // [[comp1, quantity], [comp2, quantity], ...]
    materialsArrangement: string[],
    successRatePerGizmo: number,
    noEffectChance: number,
    optimalInventionLevel: number
}

export enum WorkStatus {
    InProgress, Complete
}

export enum GizmoType {
    Armour = 'armour',
    Weapon = 'weapon',
    Tool = 'tool'
}

export interface CalcDataType {
    perkToComp: {
        tool: { [perkName: string]: string[], },
        weapon: { [perkName: string]: string[], },
        armour: { [perkName: string]: string[], }
    },
    compInfo: {
        [compName: string]: {
            tool: { perk: string, base: number, roll: number }[],
            weapon: { perk: string, base: number, roll: number }[],
            armour: { perk: string, base: number, roll: number }[],
            ancient: boolean,
        }
    },
    perkInfo: {
        [perkName: string]: {
            twoSlot: boolean,
            thresholds: number[],
            costs: number[],
            ranks: number[],
            ancientOnly: number[]
        }
    },
    compList: {
        components: { name: string, cat: number }[],
    },
    perkList: string[]
}


