import { allocateArray } from './generic_utils';

export const MAX_INV_BUDGET = 6 * (Math.floor(137 / 2) + 20 - 1) + 1;  // 523
export const MAX_INV_LVL = 137;

export const normal_gizmo_id = 0;
export const ancient_gizmo_id = 1;

const invDistroReg = []; // inv distributions for normal gizmos
const invDistroAncient = []; // inv distributions for ancient gizmos

const invphi = (Math.sqrt(5) - 1) / 2; /**   1 / phi    */
const invphi2 = (3 - Math.sqrt(5)) / 2; /**  1 / phi^2  */

export function initInvDistro() {
    /** Allocate initial PDFs */
    invDistroReg.length = MAX_INV_LVL;
    invDistroAncient.length = MAX_INV_LVL;
    for (let invLvl = 0; invLvl <= MAX_INV_LVL; invLvl++) {
        invDistroReg[invLvl] = allocateArray(MAX_INV_BUDGET + 2, 0);
        invDistroAncient[invLvl] = allocateArray(MAX_INV_BUDGET + 2, 0);
    }

    /** Generate PDFs for invention budgets */
    let layers = [];
    layers.length = 6;
    for (let i = 0; i < 6; i++) {
        layers[i] = allocateArray(MAX_INV_BUDGET, 0);
    }

    for (let invLvl = 0; invLvl <= MAX_INV_LVL; invLvl++) {
        const dV = (Math.floor(invLvl / 2) + 20); // exclusive upper bound
        const dProb = 1 / dV;

        // first layer
        for (let k = 0; k < dV; k++) {
            layers[0][k] = dProb;
        }

        // subsequent layers
        let curValue = 0;
        let curSize = dV;
        for (let L = 0; L < 5; L++) {
            let nextSize = (dV - 1) * (L + 2) + 1;

            // convolve next layer by [1 / dV] * dV
            for (let i = 0; i < nextSize; i++) {
                if (i < curSize)
                    curValue += layers[L][i];
                if (i >= dV)
                    curValue -= layers[L][i - dV];

                layers[L + 1][i] = curValue / dV;
            }
            curSize = nextSize;
            curValue = 0;
        }

        let partialSumReg = 0;
        let partialSumAncient = 0;
        for (let i = 0; i <= MAX_INV_BUDGET; i++) {
            if (i < curSize) {
                partialSumReg += layers[4][i];
                partialSumAncient += layers[5][i];
            }
            if (i >= curSize - 1) {
                invDistroReg[invLvl][i + 1] = 1.0;
                invDistroAncient[invLvl][i + 1] = 1.0;
            } else if (i >= invLvl) {
                invDistroReg[invLvl][i + 1] = partialSumReg;
                invDistroAncient[invLvl][i + 1] = partialSumAncient;
            }
        }
    };
}

function gss(f, a, b, tol?) {
    tol = tol || 1;
    [a, b] = [Math.min(a, b), Math.max(a, b)];
    let h = b - a;
    console.assert(h > 2);
    if (h <= tol)
        return [a, b];

    let n = Math.ceil(Math.log(tol / h) / Math.log(invphi));

    let c = Math.round(a + invphi2 * h);
    let d = Math.round(a + invphi * h);

    let [ycG, ycR, ycN] = f(c);
    let [ydG, ydR, ydN] = f(d);

    for (let k = 0; k < n - 1; k++) {
        if (ycG > ydG) {
            b = d;
            d = c;
            [ydG, ydR, ydN] = [ycG, ycR, ycN];
            h = b - a;
            c = Math.round(a + invphi2 * h);
            [ycG, ycR, ycN] = f(c);
        } else {
            a = c;
            c = d;
            [ycG, ycR, ycN] = [ydG, ydR, ydN];
            h = b - a;
            d = Math.round(a + invphi * h);
            [ydG, ydR, ydN] = f(d);
        }
    }

    if (ycG > ydG) {
        return [c, ycR, ycN, ycG];
    } else {
        return [d, ydR, ydN, ydG];
    }
}

function evalLvl(distrosObj, invLvl, successRanges, noEffectRanges) {
    let lvlObj = distrosObj[invLvl];
    let dRawChance = 0;
    let dNoEffChance = 0;
    let dGizmoChance;
    for (const [rP, minB, maxB] of successRanges) {
        dRawChance += rP * (lvlObj[maxB + 1] - lvlObj[minB]);
    }
    for (const [rP, minB, maxB] of noEffectRanges) {
        dNoEffChance += rP * (lvlObj[maxB + 1] - lvlObj[minB]);
    }
    dGizmoChance = dRawChance / (1 - dNoEffChance);
    return [dGizmoChance, dRawChance, dNoEffChance];
}

export function getOptimalInvLvl(useAncientGizmo, successRanges, noEffectRanges, invLvlLimit?) {
    invLvlLimit = invLvlLimit || 137;

    console.assert(invLvlLimit > 0);
    let distrosObj = useAncientGizmo ? invDistroAncient : invDistroReg;

    let lf = (lvl) => evalLvl(distrosObj, lvl, successRanges, noEffectRanges);

    return gss(lf, 0, invLvlLimit, 1);
}