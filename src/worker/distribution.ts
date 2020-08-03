import { allocateArray, sum } from './generic_utils';

let _cdfCache = new Map<string, number[]>();

export class CDF {

    _diceSum;
    _base;
    _clipMin;
    _cdf;
    constructor(dices: number[], base: number, clipMin?) {
        clipMin = clipMin || 0;

        this._diceSum = sum(dices) - dices.length;
        this._base = base;
        this._clipMin = clipMin;

        let diceKey = String(dices.sort());
        if (_cdfCache.has(diceKey)) {
            this._cdf = _cdfCache.get(diceKey);
            return;
        }
        // calc PDF
        let pdf = [1.0];
        for (let i = 0; i < dices.length; i++) {
            let newSize = pdf.length + dices[i] - 1;
            let newPdf = allocateArray(newSize, 0);

            let total = 0;
            for (let j = 0; j < newSize; j++) {
                if (j < pdf.length)
                    total += pdf[j];
                if (j >= dices[i])
                    total -= pdf[j - dices[i]];
                newPdf[j] = total * (1.0 / dices[i]);
            }
            pdf = newPdf;
        }

        // calc CDF using PDF
        let accumulation = 0;
        for (let i = 0; i < pdf.length; i++) {
            accumulation += pdf[i];
            pdf[i] = accumulation;
        }

        this._cdf = pdf;

        _cdfCache[diceKey] = this._cdf;
    }

    /**
     * Compute the probability of begin to end occurring (inclusive).
     */
    evaluate(begin, end) {
        console.assert(begin <= end, "begin must be lower than or equal to end");

        if ((end < this._base) || (end < this._clipMin))
            return 0;
        if (begin > this._diceSum + this._base)
            return 0;

        end -= this._base;
        let pointA, pointB;
        if (end >= this._diceSum) {
            pointB = 1.0
        } else {
            pointB = this._cdf[end];
        }

        if (begin - 1 < this._clipMin) {
            pointA = 0;
        } else {
            begin -= this._base;
            if (begin - 1 < 0)
                pointA = 0;
            else
                pointA = this._cdf[begin - 1]
        }
        console.assert(!Number.isNaN(pointB - pointA), `antiNaN ${pointA} ${pointB}`)
        return pointB - pointA;
    }
}
