/* Sui utils */

import { bcs } from "@mysten/sui.js/bcs";
import { DynamicFieldInfo, SuiClient, SuiExecutionResult, SuiObjectResponse } from "@mysten/sui.js/client";
import { requestSuiFromFaucetV1 } from "@mysten/sui.js/faucet";
import { TransactionBlock, TransactionResult } from "@mysten/sui.js/transactions";
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui.js/utils";
import { SuiExplorerItem } from "./types.js";
import { sleep } from "./utils-misc.js";

/**
 * Call `SuiClient.devInspectTransactionBlock()` and return the results.
 */
export async function devInspectAndGetResults(
    suiClient: SuiClient,
    txb: TransactionBlock,
    sender = "0x7777777777777777777777777777777777777777777777777777777777777777",
): Promise<SuiExecutionResult[]> {
    const resp = await suiClient.devInspectTransactionBlock({
        sender: sender,
        transactionBlock: txb
    });
    if (resp.error) {
        throw Error(`response error: ${JSON.stringify(resp, null, 2)}`);
    }
    if (!resp.results?.length) {
        throw Error(`response has no results: ${JSON.stringify(resp, null, 2)}`);
    }
    return resp.results;
}

/**
 * Call `SuiClient.devInspectTransactionBlock()` and return the deserialized return values.
 * @returns An array with the deserialized return values of each transaction in the TransactionBlock.
 */
export async function devInspectAndGetReturnValues(
    suiClient: SuiClient,
    txb: TransactionBlock,
    sender = "0x7777777777777777777777777777777777777777777777777777777777777777",
): Promise<unknown[][]> {
    const results = await devInspectAndGetResults(suiClient, txb, sender);
    /** The values returned from each of the transactions in the TransactionBlock. */
    const blockReturnValues: unknown[][] = [];
    for (const txnResult of results) {
        if (!txnResult.returnValues?.length) {
            throw Error(`transaction didn't return any values: ${JSON.stringify(txnResult, null, 2)}`);
        }
        /** The values returned from the transaction (a function can return multiple values). */
        const txnReturnValues: unknown[] = [];
        for (const value of txnResult.returnValues) {
            const valueData = Uint8Array.from(value[0]);
            const valueType = value[1];
            let valueDeserialized: unknown;
            if (valueType === "0x1::string::String") {
                valueDeserialized = bcs.string().parse(valueData);
            } else if (valueType === "vector<0x1::string::String>") {
                valueDeserialized = bcs.vector(bcs.string()).parse(valueData);
            } else {
                valueDeserialized = bcs.de(valueType, valueData, "hex");
            }
            txnReturnValues.push(valueDeserialized);
        }
        blockReturnValues.push(txnReturnValues);
    }
    return blockReturnValues;
}

/**
 * Get all dynamic object fields owned by an object.
 */
export async function fetchAllDynamicFields(
    suiClient: SuiClient,
    parentId: string,
    sleepBetweenRequests = 333, // milliseconds
    verbose = false,
): Promise<DynamicFieldInfo[]> {
    const allFieldsInfo: DynamicFieldInfo[] = [];
    let hasNextPage = true as boolean; // type cast so ESLint doesn't complain about 'no-unnecessary-condition'
    let cursor: string|null = null;
    let pageNumber = 1;
    while (hasNextPage) {
        if (verbose) {
            console.log(`Fetching page ${pageNumber}`);
        }
        pageNumber++;
        await suiClient.getDynamicFields({ parentId, cursor })
        .then(async page => {
            allFieldsInfo.push(...page.data);
            hasNextPage = page.hasNextPage;
            cursor = page.nextCursor;
            if (sleepBetweenRequests > 0) {
                await sleep(sleepBetweenRequests); // give the RPC a break
            }
        });
    }
    return allFieldsInfo;
}

/**
 * Generate a random Sui address (for development only).
 */
export function generateRandomAddress() {
    // Function to generate a random byte in hexadecimal format
    const randomByteHex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0");

    // Generate 32 random bytes and convert each to hex
    const address = "0x" + Array.from({ length: 32 }, randomByteHex).join("");

    return address;
}

/**
 * Get a `Coin<T>` of a given value from the owner. Handles coin merging and splitting.
 * Assumes that the owner has enough balance.
 */
export async function getCoinOfValue(
    suiClient: SuiClient,
    txb: TransactionBlock,
    ownerAddress: string,
    coinType: string,
    coinValue: number|bigint,
): Promise<TransactionResult> {
    let coinOfValue: TransactionResult;
    coinType = removeLeadingZeros(coinType);
    if (coinType === "0x2::sui::SUI") {
        coinOfValue = txb.splitCoins(txb.gas, [txb.pure(coinValue)]);
    }
    else {
        const paginatedCoins = await suiClient.getCoins({ owner: ownerAddress, coinType });
        // if (paginatedCoins.hasNextPage) // TODO

        // Merge all coins into one
        const [firstCoin, ...otherCoins] = paginatedCoins.data;
        const firstCoinInput = txb.object(firstCoin.coinObjectId);
        if (otherCoins.length > 0) {
            txb.mergeCoins(firstCoinInput, otherCoins.map(coin => coin.coinObjectId));
        }
        coinOfValue = txb.splitCoins(firstCoinInput, [txb.pure(coinValue)]);
    }
    return coinOfValue;
}

/**
 * Validate a SuiObjectResponse and return its content.
 * @param resp A `SuiObjectResponse` from `SuiClient.getObject()` / `.multiGetObjects()` / `.getDynamicFieldObject()`
 * @param typeRegex (optional) A regular expression to check that `resp.data.content.type` has the right type
 * @returns The contents of `resp.data.content.fields`
 */
export function getSuiObjectResponseFields(
    resp: SuiObjectResponse,
    typeRegex?: string,
): Record<string, any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (resp.error) {
        throw Error(`response error: ${JSON.stringify(resp, null, 2)}`);
    }
    if (resp.data?.content?.dataType !== "moveObject") {
        throw Error(`content missing: ${JSON.stringify(resp, null, 2)}`);
    }
    if (typeRegex && !new RegExp(typeRegex).test(resp.data.content.type)) {
        throw Error(`wrong object type: ${JSON.stringify(resp, null, 2)}`);
    }
    return resp.data.content.fields as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Build an explorer.polymedia.app URL.
 */
export function makePolymediaUrl(
    network: string,
    kind: SuiExplorerItem,
    address: string,
): string {
    const baseUrl = isLocalnet(network)
        ? "http://localhost:3000"
        : "https://explorer.polymedia.app";

    if (kind === "package") {
        kind = "object";
    } else if (kind === "coin") {
        kind = "object";
        address = address.split("::")[0];
    }

    let url = `${baseUrl}/${kind}/${address}`;
    if (network !== "mainnet") {
        const networkLabel = network === "localnet" ? "local" : network;
        url += `?network=${networkLabel}`;
    }
    return url;
}

/**
 * Build a suiscan.xyz URL.
 */
export function makeSuiscanUrl(
    network: string,
    kind: SuiExplorerItem,
    address: string,
): string {
    if (isLocalnet(network)) {
        return makePolymediaUrl(network, kind, address);
    }
    const baseUrl = `https://suiscan.xyz/${network}`;

    let path: string;
    if (kind === "address") {
        path = "account";
    } else if (kind === "txblock") {
        path = "tx";
    } else if (kind === "package") {
        path = "object";
    } else {
        path = kind;
    }

    const url = `${baseUrl}/${path}/${address}`;
    return url;
}

/**
 * Build a suivision.xyz URL.
 */
export function makeSuivisionUrl(
    network: string,
    kind: SuiExplorerItem,
    address: string,
): string {
    if (isLocalnet(network)) {
        return makePolymediaUrl(network, kind, address);
    }
    const baseUrl = network === "mainnet"
        ? "https://suivision.xyz"
        : `https://${network}.suivision.xyz`;

    let path: string;
    if (kind === "address") {
        path = "account";
    } else {
        path = kind;
    }

    const url = `${baseUrl}/${path}/${address}`;
    return url;
}

/**
 * Get SUI from the faucet on localnet/devnet/testnet.
 */
export async function requestSuiFromFaucet(
    network: "localnet"|"devnet"|"testnet",
    recipient: string,
) {
    let host: string;
    if (network == "localnet") {
        host = "http://127.0.0.1:9123/gas";
    }
    else if (network == "devnet") {
        host = "https://faucet.devnet.sui.io/v1/gas";
    }
    else {
        host = "https://faucet.testnet.sui.io/v1/gas";
    }

    return requestSuiFromFaucetV1({ host, recipient });
}

/**
 * Remove leading zeros from a Sui address (lossless). For example it will turn
 * '0x0000000000000000000000000000000000000000000000000000000000000002' into '0x2'.
 */
export function removeLeadingZeros(
    address: string,
): string {
    return address.replaceAll(/0x0+/g, "0x");
}

/**
 * Abbreviate a Sui address for display purposes (lossy). Default format is '0x1234…5678',
 * given an address like '0x1234000000000000000000000000000000000000000000000000000000005678'.
 */
export function shortenSuiAddress(
    text: string|null|undefined, start=4, end=4, separator="…", prefix="0x",
): string {
    if (!text) return "";

    const addressRegex = /0[xX][a-fA-F0-9]{1,}/g;

    return text.replace(addressRegex, (match) => {
        // check if the address is too short to be abbreviated
        if (match.length - prefix.length <= start + end) {
            return match;
        }
        // otherwise, abbreviate the address
        return prefix + match.slice(2, 2 + start) + separator + match.slice(-end);
    });
}

/**
 * A result returned by `testRpcLatency`.
 */
export type RpcTestResult = {
    endpoint: string;
    latency?: number;
    error?: string;
};

/**
 * Measure RPC latency.
 */
export async function testRpcLatency({
    endpoints,
    testType = "getLatestSuiSystemState",
    objectOrAddress,
}: {
    endpoints: string[];
    testType?: "getLatestSuiSystemState" | "getAllBalances" | "getAllCoins" | "getObject";
    objectOrAddress?: string;
}): Promise<RpcTestResult[]>
{
    const promises = endpoints.map(async (url) =>
    {
        try {
            const suiClient = new SuiClient({ url });
            const startTime = performance.now();

            if (testType === "getLatestSuiSystemState") {
                await suiClient.getLatestSuiSystemState();
            }
            else if (testType === "getAllBalances") {
                const owner = objectOrAddress ?? "0xb871a42470b59c7184033a688f883cf24eb5e66eae1db62319bab27adb30d031";
                await suiClient.getAllBalances({ owner });
            }
            else if (testType === "getAllCoins") {
                const owner = objectOrAddress ?? "0xb871a42470b59c7184033a688f883cf24eb5e66eae1db62319bab27adb30d031";
                await suiClient.getAllCoins({ owner });
            }
            else if (testType === "getObject") {
                const id = objectOrAddress ?? "0x2";
                await suiClient.getObject({ id });
            }

            const latency = performance.now() - startTime;
            return { endpoint: url, latency };
        }
        catch (err) {
            return { endpoint: url, error: String(err) };
        }
    });

    const results = await Promise.allSettled(promises);
    return results.map(result =>
    {
        if (result.status === "fulfilled") {
            return result.value;
        } else { // should never happen
            return {
                endpoint: "Unknown endpoint",
                error: result.reason.message || "Unknown error", // eslint-disable-line
            };
        }
    });
}

/**
 * Validate a Sui address and return its normalized form, or `null` if invalid.
 */
export function validateAndNormalizeSuiAddress(
    address: string,
): string | null {
    if (address.length === 0) {
        return null;
    }
    const normalizedAddr = normalizeSuiAddress(address);
    if (!isValidSuiAddress(normalizedAddr)) {
        return null;
    }
    return normalizedAddr;
}

function isLocalnet(network: string): boolean {
    return network === "localnet" || network == "http://127.0.0.1:9000";
}
