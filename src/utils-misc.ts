/* Miscellaneous utils */

/**
 * Split an array into multiple chunks of a certain size.
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        const chunk = array.slice(i, i + chunkSize);
        chunks.push(chunk);
    }
    return chunks;
}

/**
 * Convert a number to a bigint, scaled to the specified decimals.
 */
export function convertNumberToBigInt(num: number, decimals: number): bigint {
    const numScaledAsString = (num * 10**decimals).toFixed(0);
    return BigInt(numScaledAsString);
  }

/**
 * Convert a bigint to a number, scaled down to the specified decimals.
 */
export function convertBigIntToNumber(big: bigint, decimals: number): number {
    return Number(big) / 10**decimals;
}

/**
 * Format a bigint into a readable string, scaled down to the specified decimals.
 * @see formatNumber
 */
export function formatBigInt(
    big: bigint,
    decimals: number,
    format: 'standard'|'compact' = 'standard'
): string {
    const num = convertBigIntToNumber(big, decimals);
    return formatNumber(num, format);
}

/**
 * Format a number into a readable string.
 *
 * - 'standard' format:
 *   - If the number is < 1000, show 2 decimals (e.g. '123.45')
 *   - If the number is >= 1000, don't show any decimals (e.g. '1,234')
 *
 * - 'compact' format:
 *   - If the number is < 1 million, use 'standard' format
 *   - If the number is >= 1 million, use word notation (e.g. '540.23M', '20.05B')
 */
export function formatNumber(
    num: number,
    format: 'standard'|'compact' = 'standard'
): string {
    if (format === 'standard') {
        return formatNumberStandard(num);
    } else {
        return formatNumberCompact(num);
    }
}

function formatNumberStandard(num: number): string {
    if (num < 1) {
        return String(num);
    } else if (num < 1000) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
}

function formatNumberCompact(num: number): string {
    if (num < 1_000_000) {
        return formatNumberStandard(num);
    } else if (num < 1_000_000_000) {
        return formatNumberStandard(num / 1_000_000) + 'M';
    } else if (num < 1_000_000_000_000) {
        return formatNumberStandard(num / 1_000_000_000) + 'B';
    } else {
        return formatNumberStandard(num / 1_000_000_000_000) + 'T';
    }
}

/**
 * Log a message including the current date and time.
 */
export function log(level: 'log'|'info'|'debug'|'warn'|'error', ...data: unknown[]) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    console[level](`${dateStr} |`, ...data);
}

/**
 * Generate an array of ranges of a certain size between two numbers.
 *
 * For example, calling `makeRanges(0, 678, 250)` will return:
 * ```
 * [ [ 0, 250 ], [ 250, 500 ], [ 500, 678 ] ]
 * ```
 */
export function makeRanges(from: number, to: number, size: number): number[][] {
    const ranges: number[][] = [];
    for (let start = from; start < to; start += size) {
        const end = Math.min(start + size, to);
        ranges.push([start, end]);
    }
    return ranges;
}

/**
 * Wait for a number of milliseconds.
 */
export async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
