
export function allocateArray(length, fill?) {
    let newArray = [];
    newArray.length = length;
    if (fill !== undefined)
        newArray.fill(fill);
    return newArray;
}

export function zip(arr1, arr2) {
    console.assert(arr1.length === arr2.length, 'target zipped arrays must have equal length');

    let newArr = [];
    newArr.length = arr1.length;
    for (let i = 0; i < arr1.length; i++)
        newArr[i] = [arr1[i], arr2[i]];
    return newArr;
}

export function product(arrs: any[][]) {
    let output = [];

    let arrLength = arrs.length;

    let curCounter = allocateArray(arrLength, 0);
    let curOutput = allocateArray(arrLength);

    for (let i = 0; i < arrLength; i++)
        curOutput[i] = arrs[i][0];

    output.push([...curOutput]);

    while (true) {
        // add one
        curCounter[arrLength-1] += 1;
        curOutput[arrLength-1] = arrs[arrLength-1][curCounter[arrLength-1]];

        // distribute overflows
        for (let i = arrLength-1; i >= 1; i--) {
            if (curCounter[i] >= arrs[i].length) {
                curCounter[i] = 0;
                curOutput[i] = arrs[i][0];

                curCounter[i - 1] += 1;
                curOutput[i - 1] = arrs[i - 1][curCounter[i - 1]]
            }
        }
        if (curCounter[0] >= arrs[0].length)
            break;
        else
            output.push([...curOutput]);
    }
    return output;

}

export function enumerate(arr: any[]) {
    let output = allocateArray(arr.length);
    for (let i = 0; i < output.length; i++) {
        output[i] = [i, arr[i]];
    }
    return output;
}

export function iteritems(obj: any) {
    return Object.keys(obj).map(key => [key, obj[key]]);
}

export function sum(arr: number[]) {
    let acc = 0;
    for (const x of arr)
        acc += x;
    return acc;
}

export function permutations(arr: any[]) {
    // Ehrlich's swap method

    let output = [];

    let a = [...arr];

    let n = a.length;

    let b = allocateArray(n);
    let c = allocateArray(n, 0);
    for (let i = 0; i < b.length; i++)
        b[i] = i;

    while (true) {
        // E2: visit a[0]...a[n-1]
        output.push([...a]);

        let k = 1;
        while (c[k - 1] === k) {
            c[k - 1] = 0;
            k += 1;
        }

        if (k === n) break;
        else c[k - 1] += 1;

        [a[0], a[b[k]]] = [a[b[k]], a[0]];

        let j = 1;
        k -= 1;
        while (j < k) {
            [b[j], b[k]] = [b[k], b[j]];
            j += 1;
            k -= 1;
        }
    }

    return output;
}
// for (const x of product([[0, 1], [0, 1], [0, 1], [0, 1], [0, 1]]))
//     console.log(x);

// let gg = 0;
// console.time('prod test');
// for (const x of product([[1, 2, 3], [1, 2, 3, 4, 5, 6, 7], ['a', 'b', 'c'], [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8]])) {
//     gg += 1;
// }
// console.timeEnd('prod test');
// console.time('prod test2');
// for (const x of product2([[1, 2, 3], [1, 2, 3, 4, 5, 6, 7], ['a', 'b', 'c'], [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8]])) {
//     gg += 1;
// }

// console.timeEnd('prod test2');

// console.time('small permutation test');
// console.log(permutations([1, 2, 3]));
// console.timeEnd('small permutation test')

// console.time('real permutation test');
// let k = permutations([1,2,3,4,5,6,7,8,9]);
// console.log(k.length); // 362880 (9!)
// console.timeEnd('real permutation test')