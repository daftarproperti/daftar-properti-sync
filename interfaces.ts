import { EventDetails, EventContext } from "./types";

export interface DaftarPropertiSyncOptions {
  port?: number;
  address: string;
  providerHost?: string;
  abiVersion: number;
  fetchAll?: boolean;
  fromBlockNumber?: number;
  fetchLastKnownBlockNumber?: () => Promise<number>;
  listingCollection?: any;
  listingHandler: (listing: any, event: any) => Promise<void>;
  strictHash: boolean;
  errorHandling: any;
}

export interface FetchListingFromURL {
  (event: EventDetails, errorHandling: any, strictHash: boolean): Promise<any>;
}

export interface ListingHandler {
  (listing: any, event: EventDetails): Promise<void>;
}

export interface WithRetries {
  (fn: () => Promise<void>, context: EventContext, errorHandling: any): Promise<void>;
}

export interface WriteBlockNumberToFile {
  (blockNumber: number): Promise<void>;
}

export interface HandleError {
  (error: Error, context: EventContext, errorHandling: any): Promise<void>;
}