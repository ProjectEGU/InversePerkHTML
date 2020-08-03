
import { WorkStatus, CalcData, WorkerStatusReport, WorkerCalcRequest, GizmoResult } from '../worker/WorkerTypes';
import { allocateArray, zip } from './generic_utils';

import { getGizmoResults } from './gizmo_search'

const ctx: Worker = self as any;
// Courtesy of https://github.com/webpack-contrib/worker-loader/issues/190
export default {} as typeof Worker & (new () => Worker);

// reporting functions
function reportProgressPercent(percent: number) {
    ctx.postMessage({
        workerStatus: WorkStatus.InProgress,
        percentComplete: Math.round(percent),
        result: []
    } as WorkerStatusReport);
};

function reportCalculationComplete(result: GizmoResult[]) {
    ctx.postMessage({
        workerStatus: WorkStatus.Complete,
        percentComplete: 100,
        result: result
    } as WorkerStatusReport);
}

// default excluded perks, with exception: if target perk is in the excluded perk names, then don't exclude that perk
const defaultUndesiredPerks = ["Demon Bait", "Fatiguing", "Cautious", "Dragon Bait",
    "Committed", "Profane", "Inaccurate", "Blunted", "Junk food", "Confused", 'Antitheism'];

const defaultExclusionMaterials = [];



// Main calculation
// Respond to message from parent thread
ctx.onmessage = (event) => {
    let data = event.data as WorkerCalcRequest;
    console.log('calculation begin');
    console.time('calculation');
    // ffs(reportProgressPercent);

    let perkName1 = data.targetPerkNames[0];
    let perkName2 = data.targetPerkNames[1];
    let perkRank1 = data.targetPerkRanks[0];
    let perkRank2 = data.targetPerkRanks[1];

    let allResults = getGizmoResults(data.targetGizmoAncient, data.targetGizmoType,
        perkName1, perkRank1, perkName2, perkRank2, defaultUndesiredPerks, defaultExclusionMaterials,
        reportProgressPercent);

    reportCalculationComplete(allResults);
    console.timeEnd('calculation');
}
