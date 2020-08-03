
import { CalcData, ANY_PERK, GizmoResult, GizmoType, NO_PERK, } from '../worker/WorkerTypes';
import { allocateArray, enumerate, product, zip, sum, permutations } from './generic_utils';
import { CDF } from './distribution';
import { jagsort } from './jagsort'
import {
    MAX_INV_BUDGET, MAX_INV_LVL, normal_gizmo_id, ancient_gizmo_id,
    getOptimalInvLvl, initInvDistro
} from './inv_budget_utils'

// init invention table
console.time('init invention budget CDFs table'); // ~15ms
initInvDistro();
console.timeEnd('init invention budget CDFs table');

const assert = console.assert;

interface CalcConfig {
    TopConfigurationCount: number,
    UndesiredPerks: Set<string>,
    ExcludeMaterials: Set<string>,
    QuantityLimit: number,
    ArrangementLimitPerQuantity: number,
    AllowAnySecondPerk: boolean,
    SanityChecks: boolean
}

const _searchConfig: CalcConfig = {
    TopConfigurationCount: 30,
    UndesiredPerks: new Set(),
    ExcludeMaterials: new Set(),
    QuantityLimit: 1250, // 7500 // 500
    ArrangementLimitPerQuantity: 200,
    AllowAnySecondPerk: false,
    SanityChecks: true
}

class PerkRank {
    name: string;
    maxRank: number;
    rankCosts: number[];
    rankProbs: number[];
    twoSlot: boolean;
    curRank: number;
    curCost: number;
    curProb: number;

    constructor(name, maxRank, rankCosts, rankProbs, twoSlot) {
        this.name = name;
        this.maxRank = maxRank;
        this.curRank = 0;
        this.curProb = rankProbs[0];
        this.curCost = 0;
        this.twoSlot = twoSlot;

        // a list from 0 to maxRank, of size maxRank+1
        // because a rank of 0 is possible
        this.rankCosts = rankCosts;
        this.rankProbs = rankProbs;
    }

    setRank(rank) {
        assert(rank <= this.maxRank && rank >= 0, rank);

        this.curRank = rank;
        this.curProb = this.rankProbs[rank];
        this.curCost = this.rankCosts[rank];
        if (this.curCost === 0 || this.curRank === 0)
            assert(this.curCost === 0 && this.curRank === 0, 'only rank 0 may have 0 cost');
    }
}

class SearchResult {
    rawSuccessChance: number = 0;
    noEffectChance: number = 0;
    potentialRawChance: number = 0;
    materialsArrangement: number;
    inventionLevel: number = 0;

    gizmoChance: number;
    potentialGizmoChance: number;

    optimalInvLvl: number = 0;

    constructor(materialsArrangement) {
        this.materialsArrangement = materialsArrangement;
    }

    calcGizmoChance() {
        if (this.noEffectChance !== 1.0) {
            this.gizmoChance = this.rawSuccessChance / (1.0 - this.noEffectChance);
        } else {
            this.gizmoChance = 0;
            this.potentialGizmoChance = 0;
        }
    }

}

function getQuantities(minContribs, maxContribs, targetMinContrib, targetMaxContrib, maxQuantity, getProbabilities) {
    /** 
    targetMinContribs=[30,50]
    targetMaxContribs=[70,90]

    minContribs = [ [20,30],
                    [40,50] ]
    maxContribs = [ [ , ], ... ]

    :return: A list of all possible combinations of numbers k_1 to k_n such that
    the sum of k_1 to k_n is less than or equal to the max quantity, and that
    the elementwise sum of k_1 * minContribs[1] to k_n * minContribs[n]
    is less than or equal to the targetMaxContrib, and also
    the elementwise sum of k_1 * maxContribs[1] to k_n * maxContribs[n]
    is more than or equal to the targetMinContrib
    */

    let output = [];

    assert(minContribs.length === maxContribs.length);
    assert(targetMinContrib.length === targetMaxContrib.length);

    const contribsCount = minContribs.length;
    const targetsCount = targetMinContrib.length;

    let counts = allocateArray(contribsCount, 0);
    let curMins = allocateArray(targetsCount, 0);
    let curMaxs = allocateArray(targetsCount, 0);
    // console.log('[getQuantities]', minContribs, maxContribs);
    // console.log('[getQuantities]', targetMinContrib, targetMaxContrib, maxQuantity)
    let recursion = (curIdx, quantityRemain) => {
        if (zip(curMins, targetMaxContrib).some(([cmin, tmax]) => (cmin > tmax)))
            return;

        if (quantityRemain === 0 || curIdx === contribsCount) {
            if (!zip(curMaxs, targetMinContrib).some(([cmax, tmin]) => (cmax < tmin))) {
                if (!getProbabilities) {
                    output.push([...counts]);
                }
            }
            return;
        }

        for (let nq = 0; nq <= quantityRemain; nq++) { // nq: new quantity
            counts[curIdx] = nq;
            recursion(curIdx + 1, quantityRemain - nq);

            for (let i = 0; i < targetsCount; i++) {
                curMins[i] += minContribs[curIdx][i];
                curMaxs[i] += maxContribs[curIdx][i];
            }
        }

        for (let i = 0; i < targetsCount; i++) {
            curMins[i] -= (quantityRemain + 1) * minContribs[curIdx][i];
            curMaxs[i] -= (quantityRemain + 1) * maxContribs[curIdx][i];
        }
        counts[curIdx] = 0;
    };

    recursion(0, maxQuantity);
    return output;
}

function* getPerkOrderings(gizmoType, componentList, quantityList, useAncientGizmo, limit) {
    /**
     *     Returns all distinct perk orderings along with material orderings.
     *
     *     The order of the perks' appearance in the perk cost list is uniquely
     *     determined by the order that components first appear in.
     *
     *     We place one of each different component first, in different orders,
     *     then place the remaining components (if any).
     *     
     *     Returns a generator of tuples of the format (materialArrangement, perkOrdering)
     */

    let firstComponents = [];
    let tailComponents = [];
    for (const [compName, quantity] of zip(componentList, quantityList)) {
        if (!useAncientGizmo) {
            let isCompAncient = CalcData.compInfo[compName].ancient;
            assert(!isCompAncient, 'ancient components cannot be used in a regular gizmo');
        }
        if (quantity > 0)
            firstComponents.push(compName);
        if (quantity > 1)
            tailComponents = tailComponents.concat(allocateArray(quantity - 1, compName)); // concat with [compName] * (quantity - 1)
    }

    let perkOrderingsUsed = new Set();
    let perkOrdering = [];
    let perksUsed = new Set();
    let generatedCount = 0;
    for (const initialCompArrangement of permutations(firstComponents)) {
        perkOrdering.length = 0;
        perksUsed.clear();

        for (const compName of initialCompArrangement) {
            let compPerks = CalcData.compInfo[compName][gizmoType];
            for (const perkInfo of compPerks) {
                let perkName = perkInfo.perk;
                if (!perksUsed.has(perkName)) {
                    perksUsed.add(perkName);
                    perkOrdering.push(perkName);
                }
            }
        }
        let perkOrderingKey = perkOrdering.join(' ');
        if (!perkOrderingsUsed.has(perkOrderingKey)) {
            perkOrderingsUsed.add(perkOrderingKey);
            let materialArrangements = initialCompArrangement.concat(tailComponents);
            let newPerkOrder = [...perkOrdering];

            yield [materialArrangements, newPerkOrder];
            generatedCount += 1;
        } else {

        }
        if (generatedCount >= limit)
            break;
    }
}

let debugSuccessChanceRangesRequested = [];
let debugNoEffectChanceRangesRequested = [];
let debugPotentialSuccessChanceRangesRequested = [];

const costSortFn = (x: PerkRank, y: PerkRank) => x.curCost - y.curCost;

function getArrangementResult(materialsArrangement, originalOrdering: PerkRank[], sortedOrderBuffer: PerkRank[],
    useAncientGizmo, perkName1, perkRank1, perkName2, perkRank2) {
    debugSuccessChanceRangesRequested.length = 0;
    debugNoEffectChanceRangesRequested.length = 0;
    debugPotentialSuccessChanceRangesRequested.length = 0;
    /** 
    Given the particular unsorted ordering of PerkRank objects and the perk targets,
    return a list of (invLevel, SearchResult) tuples for each of the specified invention levels.

    :return: A list of SearchResult object for each invention level specified
    */
    let outputResult = new SearchResult(materialsArrangement);
    let perkRankValues = allocateArray(originalOrdering.length);

    let targetPerkObj1, targetPerkObj2;
    // set desired ranks in perkRankValues
    for (const [i, m] of enumerate(originalOrdering)) {
        let possibleRanks = [];
        for (let rank = 0; rank <= m.maxRank; rank++) {
            if (m.rankProbs[rank] > 0.001)
                possibleRanks.push(rank);
        }
        perkRankValues[i] = possibleRanks;

        if (m.name === perkName1)
            targetPerkObj1 = m;
        else if (m.name === perkName2)
            targetPerkObj2 = m;
    }

    /**
     * Iterate through all combinations of ranks, and get all possible generated perks and their
     * respective probabilities.
     */
    for (const rankValues of product(perkRankValues)) {
        // console.log('[getArrangementResult]', JSON.stringify(rankValues));
        for (let i = 0; i < rankValues.length; i++) {
            originalOrdering[i].setRank(rankValues[i]);
            sortedOrderBuffer[i] = originalOrdering[i];
        }

        // calculate the probability that this specific rank of perks is generated from perk values
        let rankProb = 1.0;
        for (const perkObj of originalOrdering)
            rankProb *= perkObj.curProb;

        // optimization: if the generated perk rank is different from desired, then only assess the noEffectChance
        let diffRank = targetPerkObj1.curRank != perkRank1 || (targetPerkObj2 && targetPerkObj2.curRank != perkRank2);
        if (diffRank) {
            let minBudget = 0;
            let maxBudget = 9999;
            let perkCombo = [];
            let perkCount = 0;
            let perkCostsUnsorted = originalOrdering.map(perkObj => perkObj.curCost).filter(cost => cost > 0);
            if (perkCostsUnsorted.length !== 0) // if not all costs are zero
                maxBudget = Math.min(...perkCostsUnsorted);

            if (maxBudget > MAX_INV_BUDGET)
                maxBudget = MAX_INV_BUDGET;

            updateSelectionProbabilities(outputResult, perkName1, perkRank1, perkName2, perkRank2,
                targetPerkObj1, targetPerkObj2, perkCombo, perkCount, rankProb, minBudget, maxBudget);
        } else {
            jagsort(0, sortedOrderBuffer.length - 1, sortedOrderBuffer, costSortFn);
            let sortedPerkCosts = sortedOrderBuffer;

            for (let [minBudget, maxBudget, perkCombo, perkCount] of getComboBudgets(sortedPerkCosts)) {
                if (minBudget > MAX_INV_BUDGET)
                    continue;
                if (maxBudget > MAX_INV_BUDGET)
                    maxBudget = MAX_INV_BUDGET;

                updateSelectionProbabilities(outputResult, perkName1, perkRank1, perkName2, perkRank2,
                    targetPerkObj1, targetPerkObj2, perkCombo, perkCount, rankProb, minBudget, maxBudget);
            }

        }
    }

    let [optimA, optimSucc, optimNF, optimGiz] = getOptimalInvLvl(useAncientGizmo,
        debugSuccessChanceRangesRequested,
        debugNoEffectChanceRangesRequested);

    let [optimPotential, optimSuccP, optimNF_P, optimGizP] = getOptimalInvLvl(useAncientGizmo,
        debugPotentialSuccessChanceRangesRequested,
        debugNoEffectChanceRangesRequested);

    // console.log('[getArrangementResults]', 'check ranges', JSON.stringify(debugSuccessChanceRangesRequested));

    outputResult.optimalInvLvl = optimA;

    outputResult.potentialGizmoChance = optimGizP;
    outputResult.rawSuccessChance = optimSucc;
    outputResult.noEffectChance = optimNF;
    outputResult.calcGizmoChance();

    console.assert(outputResult.gizmoChance === optimGiz, `${outputResult.gizmoChance} ${optimGiz}`);

    return outputResult;
}

function getRankProbabilities(gizmoType, componentList, quantityList, useAncientGizmo) {
    /**
     * Return a dict mapping of perkName -> perkRank object
     */

    let perkBaseDices = new Map();
    for (const [compName, quantity] of zip(componentList, quantityList)) {
        let compPerks = CalcData.compInfo[compName][gizmoType];
        let isCompAncient = CalcData.compInfo[compName].ancient;

        assert(useAncientGizmo || !isCompAncient, 'ancient components cannot be used in a regular gizmo');
        for (const perkInfo of compPerks) {
            let [perkName, perkBase, perkRoll] = [perkInfo.perk, perkInfo.base, perkInfo.roll];
            // console.log('[getRankProbabilities]', perkName, perkBase, perkRoll, compName, quantity);
            if (!perkBaseDices.has(perkName))
                perkBaseDices.set(perkName, [0, []]);

            let CDFparams = perkBaseDices.get(perkName); // [base, rolls]

            if (useAncientGizmo && !isCompAncient) {
                // regular component used in an ancient gizmo is only 80% efficient
                CDFparams[0] += Math.floor(perkBase * 0.8) * quantity;
                CDFparams[1].push(...allocateArray(quantity, Math.floor(perkRoll * 0.8)));
            } else {
                CDFparams[0] += perkBase * quantity;
                CDFparams[1].push(...allocateArray(quantity, perkRoll));

            }

            // console.log('[getRankProbabilities]', JSON.stringify(CDFparams));
        }
    }

    let perkRanks = new Map();
    for (const [perkName, [base, rolls]] of perkBaseDices.entries()) {
        let perkInfo = CalcData.perkInfo[perkName];

        let maxRankAncient = perkInfo['ancientOnly'].indexOf(1);
        let maxRank = (useAncientGizmo || maxRankAncient === -1) ? perkInfo.ranks.length : maxRankAncient;

        let rankProbs = allocateArray(maxRank + 1, 0);
        let perkValueCDF = new CDF(rolls, base);
        let perkThresholds = perkInfo.thresholds.slice(0, maxRank);
        let rankCosts = [0].concat(CalcData.perkInfo[perkName].costs.slice(0, maxRank));
        let isTwoSlot = perkInfo.twoSlot;
        if (perkThresholds.length > 0) {
            rankProbs[0] = perkValueCDF.evaluate(0, perkThresholds[0] - 1);
            for (let rank = 1; rank < maxRank; rank++) {
                rankProbs[rank] = perkValueCDF.evaluate(perkThresholds[rank - 1], perkThresholds[rank] - 1);
            }
            rankProbs[rankProbs.length - 1] = perkValueCDF.evaluate(perkThresholds[maxRank - 1], 9999);
            perkRanks.set(perkName, new PerkRank(perkName, maxRank, rankCosts, rankProbs, isTwoSlot));
        }


    }

    // console.log('[getRankProbabilities]',
    //     [...perkRanks.entries()].map(([k, v]) => `${k}: costs: ${JSON.stringify(v.rankCosts)}, probs: ${JSON.stringify(v.rankProbs)}`))
    return perkRanks;
}

function updateSelectionProbabilities(searchResultObj: SearchResult, perkName1, perkRank1, perkName2, perkRank2,
    targetPerkObj1: PerkRank, targetPerkObj2: PerkRank, perkCombo, perkCount, rankProb, minBudget, maxBudget) {
    /**
     * Get the slices of the invention distribution PDF that would be totalled
     */

    // console.log('[updateSelectionProbabilities]', rankProb, minBudget, maxBudget)

    if (perkCount === 0) {
        debugNoEffectChanceRangesRequested.push([rankProb, minBudget, maxBudget]);
    } else if (perkCount === 1 || (perkCombo[0].twoSlot || perkCombo[1].twoSlot)) {
        if (!perkName2 || _searchConfig.AllowAnySecondPerk)
            if (perkName1 === perkCombo[0].name && perkRank1 === perkCombo[0].curRank)
                debugSuccessChanceRangesRequested.push([rankProb, minBudget, maxBudget]);
    } else if (perkCount === 2) {
        if (_searchConfig.AllowAnySecondPerk) {
            let match1 = perkName1 === perkCombo[0].name && perkRank1 === perkCombo[0].curRank;
            let match2 = perkName1 === perkCombo[1].name && perkRank1 === perkCombo[1].curRank;
            if (match1) {
                if (!_searchConfig.UndesiredPerks.has(perkCombo[1].name))
                    debugSuccessChanceRangesRequested.push([rankProb, minBudget, maxBudget]);
            } else if (match2) {
                if (!_searchConfig.UndesiredPerks.has(perkCombo[0].name)) {
                    debugSuccessChanceRangesRequested.push([rankProb, minBudget, maxBudget]);
                }
            }
        } else if (perkName2) {
            let nameMatch1 = perkName1 === perkCombo[0].name && perkName2 === perkCombo[1].name;
            let rankMatch1 = perkRank1 === perkCombo[0].curRank && perkRank2 === perkCombo[1].curRank;
            let nameMatch2 = perkName1 === perkCombo[1].name && perkName2 === perkCombo[0].name;
            let rankMatch2 = perkRank1 === perkCombo[1].curRank && perkRank2 === perkCombo[0].curRank;
            if (nameMatch1 && rankMatch1)
                debugSuccessChanceRangesRequested.push([rankProb, minBudget, maxBudget]);
            else if (nameMatch2 && rankMatch2)
                debugSuccessChanceRangesRequested.push([rankProb, minBudget, maxBudget]);
        }
    }

    // Update potentialRawChance
    if (perkCount > 0) {
        let sc1 = perkCombo[0].curCost;
        let tc1 = targetPerkObj1.curCost;

        if (!perkName2 || _searchConfig.AllowAnySecondPerk) {
            if (targetPerkObj1.twoSlot) {
                if (tc1 === sc1)
                    debugPotentialSuccessChanceRangesRequested.push([rankProb, minBudget, maxBudget]);
            } else {
                if (sc1 === tc1) {
                    debugPotentialSuccessChanceRangesRequested.push([rankProb, minBudget, maxBudget]);
                } else if (perkCount === 2) {
                    let sc2 = perkCombo[1].curCost;
                    if (sc1 === tc1 || sc2 === tc1)
                        debugPotentialSuccessChanceRangesRequested.push([rankProb, minBudget, maxBudget]);
                }
            }
        } else if (perkName2) {
            if (perkCount === 2) {
                let sc2 = perkCombo[1].curCost;
                let tc2 = targetPerkObj2.curCost;
                if ((sc1 === tc1 && sc2 === tc2) || (sc2 === tc1 && sc1 === tc2))
                    debugPotentialSuccessChanceRangesRequested.push([rankProb, minBudget, maxBudget]);
            }
        }
    }
}

function* getComboBudgets(sortedPerkCosts) {
    /** 
    Get a list of perk costs, sorted by cost (ascending), retrieve the range of invention budget required to select
    each combination of perks (including 0, 1 or 2 perks).
    Returns: A perkCombo combination, and the range of invention budget required to select that combination
    (and not other combinations). Generates tuples of the format (minBudget, maxBudget, perkCombo: PerkRank(length of 0-2),
    perkCount (length of perkCombo))
    */
    let [leastCostIdx, leastCost] = [0, 9999];
    for (const [i, { curCost }] of enumerate(sortedPerkCosts)) {
        if (curCost > 0) {
            [leastCostIdx, leastCost] = [i, curCost];
            break;
        }
    }

    yield [0, leastCost, [], 0]; // [minBudget, maxBudget, perkArr, perkArrLength]

    let prevCostA = 9999;
    for (let idxA = sortedPerkCosts.length - 1; idxA >= 0; idxA--) {
        let perkObjA: PerkRank = sortedPerkCosts[idxA];
        let costA = perkObjA.curCost;
        if (costA === 0 || costA === prevCostA)
            continue;
        let oneItemMin = costA + 1;
        let oneItemMax;
        if (idxA === leastCostIdx)
            oneItemMax = prevCostA;
        else
            oneItemMax = Math.min(prevCostA, costA + leastCost);

        yield [oneItemMin, oneItemMax, [perkObjA], 1];

        let prevCostB = 9999;
        for (let idxB = idxA - 1; idxB >= 0; idxB--) {
            let perkObjB: PerkRank = sortedPerkCosts[idxB];
            let costB = perkObjB.curCost;
            if (costB === 0 || costB === prevCostB || (costA) + (costB + 1) > prevCostA)
                continue;
            let twoItemMin = (costA) + (costB + 1);
            let twoItemMax = Math.min(prevCostA, costA + prevCostB);
            yield [twoItemMin, twoItemMax, [perkObjA, perkObjB], 2];
            prevCostB = costB;
        }
        prevCostA = costA;
    }
}
function getCompCandidates(gizmoType, perkName1, perkRank1, perkName2, perkRank2,
    useAncientGizmo) {
    let comps1: string[] = CalcData.perkToComp[gizmoType][perkName1];
    let comps2: string[] = perkName2 ? CalcData['perkToComp'][gizmoType][perkName2] : [];

    let componentList = [...new Set(comps1.concat(comps2))];

    if (!useAncientGizmo) {
        // filter out ancient components if using non ancient gizmo
        componentList = componentList.filter(compName => !CalcData.compInfo[compName].ancient);
    }
    // filter out excluded components
    componentList = componentList.filter(compName => !_searchConfig.ExcludeMaterials.has(compName));
    componentList.sort();

    let targetPerks = [[perkName1, perkRank1]];
    if (perkName2)
        targetPerks.push([perkName2, perkRank2]);

    let minContribs = [];
    let maxContribs = [];
    for (let i = 0; i < componentList.length; i++) {
        minContribs.push([]); maxContribs.push([]);
    }
    let targetMinContribs = [];
    let targetMaxContribs = [];

    for (const [perk, rank] of targetPerks) {
        let perkInfo = CalcData.perkInfo[perk];
        let perkThreshes = perkInfo.thresholds;

        assert(rank <= perkThreshes.length, 'rank exceeds maximum');
        assert(rank > 0, "rank must be at least 1");
        assert(useAncientGizmo || perkInfo.ancientOnly[rank - 1] === 0, 'this rank is only possible in ancient gizmo shells');

        for (const [cIdx, compName] of enumerate(componentList)) {
            let compInfo = CalcData.compInfo[compName];
            let compPerkContribs = compInfo[gizmoType];
            let contribInfo = compPerkContribs.filter(p => p.perk === perk);
            let isCompAncient = compInfo.ancient;
            if (contribInfo.length > 0) {
                let base = contribInfo[0].base;
                let roll = contribInfo[0].roll;
                if (useAncientGizmo && !isCompAncient) {
                    minContribs[cIdx].push(Math.floor(base * 0.8));
                    maxContribs[cIdx].push(Math.floor(base * 0.8) + Math.floor(roll * 0.8) - 1)
                } else {
                    minContribs[cIdx].push(base);
                    maxContribs[cIdx].push(base + roll - 1);
                }
            } else {
                minContribs[cIdx].push(0);
                maxContribs[cIdx].push(0);
            }
        }
        // console.log('[getCompCandidates]', perkThreshes, rank, perkThreshes.length);
        targetMinContribs.push(perkThreshes[rank - 1]);
        targetMaxContribs.push((rank === perkThreshes.length) ? 9999 : (perkThreshes[rank] - 1));
    }

    let quantitiesList = getQuantities(minContribs, maxContribs, targetMinContribs, targetMaxContribs,
        useAncientGizmo ? 9 : 5, false);
    return [componentList, quantitiesList];
}


export function getGizmoResults(useAncientGizmo, gizmoType, perkName1, perkRank1,
    perkName2?, perkRank2?,
    undesiredPerks?, excludeMaterials?, progressReportFn?: (number) => void): GizmoResult[] {
    console.log('[getGizmoResults]', JSON.stringify(arguments));
    if (perkName2 === ANY_PERK) {
        perkName2 = null;
        perkRank2 = null;
        _searchConfig.AllowAnySecondPerk = true;
    }
    if (undesiredPerks)
        _searchConfig.UndesiredPerks = new Set(undesiredPerks);
    else
        _searchConfig.UndesiredPerks = new Set();

    if (excludeMaterials)
        _searchConfig.ExcludeMaterials = new Set(excludeMaterials);
    else
        _searchConfig.ExcludeMaterials = new Set();



    // if target perk is an undesired perk, then remove it from undesired perks
    _searchConfig.UndesiredPerks.delete(perkName1);
    _searchConfig.UndesiredPerks.delete(perkName2);

    if (!_searchConfig.AllowAnySecondPerk && perkName2) {
        let isPerk1twoSlot = CalcData.perkInfo[perkName1].twoSlot;
        let isPerk2twoSlot = CalcData.perkInfo[perkName2].twoSlot;
        assert(!(isPerk1twoSlot || isPerk2twoSlot), 'cannot combine a second perk with a two-slot perk');
    }

    let [componentList, quantitiesInfoList] = getCompCandidates(gizmoType, perkName1, perkRank1, perkName2, perkRank2,
        useAncientGizmo);
    // quantitiesInfoList =[[1, 0, 4, 4, 0], [0, 1, 4, 4, 0], [0, 0, 4, 4, 1]]  // debug forced
    // console.log('[getGizmoResults]', componentList, JSON.stringify(quantitiesInfoList));

    let intermediateResults = [];
    for (const quantities of quantitiesInfoList) {
        let arrangementGenerator = getPerkOrderings(gizmoType, componentList, quantities,
            useAncientGizmo, useAncientGizmo ? 362880 : 720);

        let rankProbs = getRankProbabilities(gizmoType, componentList, quantities,
            useAncientGizmo);

        intermediateResults.push([quantities, rankProbs, arrangementGenerator, [null]]);

        if (intermediateResults.length >= _searchConfig.QuantityLimit) {
            console.log('Quantity limit reached');
            break;
        }
    }



    console.time('check quantities');
    let quantitiesChecked = 0;
    let quantitiesTotal = Math.min(quantitiesInfoList.length, _searchConfig.QuantityLimit);
    for (const [quantities, rankProbs, arrangementGenerator, arrangementResult] of intermediateResults) {
        let { value, done } = arrangementGenerator.next();
        if (done) {
            console.error('At least one perk ordering must exist for this configuration of quantities');
            continue;
        }
        let [matArrangements, perkOrdering] = value;

        let originalOrdering: PerkRank[] = perkOrdering.map(perkName => rankProbs.get(perkName));
        let sortedOrderBuffer = allocateArray(perkOrdering.length);

        let result: SearchResult = getArrangementResult(matArrangements, originalOrdering, sortedOrderBuffer,
            useAncientGizmo, perkName1, perkRank1, perkName2, perkRank2);

        arrangementResult[0] = result;
        quantitiesChecked += 1;
        if (quantitiesChecked % 10 === 0)
            progressReportFn?.(75 * (quantitiesChecked / quantitiesTotal));


    }
    console.timeEnd('check quantities');

    if (intermediateResults.length > _searchConfig.TopConfigurationCount) {
        // intermediateResults: [(quantities, rankProbs, arrangementGenerator, arrangementResult), ...]
        intermediateResults.sort((a, b) => b[3][0].gizmoChance - a[3][0].gizmoChance);
        let kthGizmoChance = intermediateResults[_searchConfig.TopConfigurationCount - 1][3][0].gizmoChance;
        let lenA = intermediateResults.length;
        intermediateResults = intermediateResults.splice(0, _searchConfig.TopConfigurationCount)
            .concat(intermediateResults.filter(item => item[3][0].potentialGizmoChance > kthGizmoChance));
        let lenB = intermediateResults.length;
        console.log('Items filtered: ', lenA - lenB);
    }

    console.time('expand quantities');
    let expandedQuantitiesCount = 0;

    for (const item of intermediateResults) {
        let [quantities, rankProbs, arrangementGenerator, arrangementResult] = item;
        if (arrangementResult[0]) {
            let arrangementsExpanded = 0;
            while (true) {
                let { value, done } = arrangementGenerator.next();

                if (done) {
                    delete item[2]; // delete arrangementGenerator
                    break;
                } else {
                    let [matArrangements, perkOrdering] = value;
                    let originalOrdering: PerkRank[] = perkOrdering.map(perkName => rankProbs.get(perkName));
                    let sortedOrderBuffer = allocateArray(perkOrdering.length);

                    let result: SearchResult = getArrangementResult(matArrangements, originalOrdering, sortedOrderBuffer,
                        useAncientGizmo, perkName1, perkRank1, perkName2, perkRank2);

                    if (result.gizmoChance > arrangementResult[0].gizmoChance)
                        arrangementResult[0] = result;

                    arrangementsExpanded += 1;
                    if (arrangementsExpanded >= _searchConfig.ArrangementLimitPerQuantity) {
                        console.log('Arrangement expansion limit reached');
                        break;
                    }
                }
            }

            expandedQuantitiesCount += 1;
            if (expandedQuantitiesCount % 10 === 0)
                progressReportFn?.(75 + 25 * (expandedQuantitiesCount / intermediateResults.length));
        }
    }

    console.timeEnd('expand quantities');

    let allResults = intermediateResults.map(([quantities, rankProbs, arrangementGenerator, arrangementResult]) =>
        [componentList, quantities, arrangementResult[0]]);

    allResults.sort((resA, resB) => {
        if (Math.abs(resA[2].gizmoChance - resB[2].gizmoChance) > 0.00001) {
            return resB[2].gizmoChance - resA[2].gizmoChance; // first sort by descending gizmo chance
        } else {
            return sum(resA[1]) - sum(resB[1]); // secondary sort by ascending number of components
        }
    });
    allResults = allResults.slice(0, _searchConfig.TopConfigurationCount);
    return allResults.map(([componentList, quantities, arrangementResult]) => ({
        componentQuantities: zip(componentList, quantities).filter(([comp, quantity]) => quantity > 0),
        materialsArrangement: arrangementResult.materialsArrangement,
        successRatePerGizmo: arrangementResult.gizmoChance,
        noEffectChance: arrangementResult.noEffectChance,
        optimalInventionLevel: arrangementResult.optimalInvLvl
    } as GizmoResult));
}

/**
 * DEBUG
 * [todo fix: as4sc2 targetPerkObj1]
 * [todo fix: NoSecondaryPerk option]
 * {"0":true,"1":"weapon","2":"Aftershock","3":4,"4":"Scavenging",
 * "5":2,"6":["Demon Bait","Fatiguing","Cautious","Dragon Bait","Committed","Profane","Inaccurate","Blunted","Junk food","Confused"],
 * "7":[]}
 */
/**
 * FIX two
 * {"0":false,"1":"weapon","2":"Looting","3":1,
 * "4":"","6":
 * ["Demon Bait","Fatiguing","Cautious","Dragon Bait","Committed","Profane","Inaccurate","Blunted","Junk food","Confused"],"7":[]} 
 * 
 */
// _searchConfig.TopConfigurationCount = 3;
// _searchConfig.QuantityLimit = 3;
// _searchConfig.ArrangementLimitPerQuantity = 3;


// console.time('calculation');
// const negativePerks = ["Demon Bait", "Fatiguing", "Cautious", "Dragon Bait", "Committed", "Profane", "Inaccurate", "Blunted", "Junk food", "Confused"];
// // let allResults = getGizmoResults(false, GizmoType.Armour, 'Scavenging', 3, ANY_PERK, 0, [], [], console.log);
// // let allResults = getGizmoResults(false, GizmoType.Armour, 'Looting', 1, ANY_PERK, 0, [], [], undefined);
// // let allResults = getGizmoResults(true, 'weapon', 'Aftershock', 4, 'Scavenging', 2, negativePerks, [], undefined);
// // let allResults = getGizmoResults(false, 'weapon', 'Looting', 1, NO_PERK, '', negativePerks, []);
// let allResults = getGizmoResults(true, 'weapon', 'Equilibrium', 4, 'Scavenging', 1, negativePerks, [], undefined);
// console.log(allResults);
// console.timeEnd('calculation');
