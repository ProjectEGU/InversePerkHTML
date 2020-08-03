export function jagsort(low, high, arr, compareFn) {
    let pivot_index = Math.floor((low + high) / 2);
    let pivot_value = arr[pivot_index];
    arr[pivot_index] = arr[high];
    arr[high] = pivot_value;
    let counter = low;
    let loop_index = low;
    while (loop_index < high) {
        if (compareFn(arr[loop_index], pivot_value) < (loop_index & 1)) {
            let temp = arr[loop_index];
            arr[loop_index] = arr[counter];
            arr[counter] = temp;
            counter += 1;
        }
        loop_index += 1;
    }

    arr[high] = arr[counter];
    arr[counter] = pivot_value;

    if (low < (counter - 1))
        jagsort(low, counter - 1, arr, compareFn);
    if ((counter + 1) < high)
        jagsort(counter + 1, high, arr, compareFn);
}
