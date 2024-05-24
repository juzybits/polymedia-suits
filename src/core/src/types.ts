/**
 * A Sui network name.
 */
export type NetworkName =  "mainnet" | "testnet" | "devnet" | "localnet";

/**
 * A Polymedia Explorer item type, as in:
 * https://explorer.polymedia.app/address/...
 * https://explorer.polymedia.app/object/...
 * https://explorer.polymedia.app/package/...
 * https://explorer.polymedia.app/txblock/...
 */
export type SuiExplorerItem = "address" | "object" | "package" | "txblock" | "coin";
