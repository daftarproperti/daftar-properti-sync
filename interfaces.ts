import { BroadcastOptions } from "./broadcast/interface";
import { EventDetails, BuyerRequestEventDetails, EventContext, BuyerRequestEventContext, Listing, BuyerRequest } from "./types";

export interface DaftarPropertiSyncOptions {
  port?: number;
  address: string;
  providerHost?: string;
  abiVersion: number;
  fetchAll?: boolean;
  fromBlockNumber?: number;
  fetchLastKnownBlockNumber?: () => Promise<number>;
  listingCollection?: any;
  listingHandler?: (listing: Listing, event: any) => Promise<void>;
  strictHash: boolean;
  errorHandling: any;
  broadcastOptions?: BroadcastOptions;
  getListingUpdatedAt?: GetListingUpdatedAt;
}

export interface FetchListingFromURL {
  (event: EventDetails, errorHandling: any, strictHash: boolean): Promise<any>;
}

export interface ListingHandler {
  (listing: Listing, event: EventDetails): Promise<void>;
}

export interface GetListingUpdatedAt {
  (listingId: string): Promise<string>;
}

export interface WithRetries {
  (fn: () => Promise<void>, context: EventContext, errorHandling: any): Promise<void>;
}

export interface BuyerRequestWithRetries {
  (fn: () => Promise<void>, context: BuyerRequestEventContext, errorHandling: any): Promise<void>;
}

export interface WriteBlockNumberToFile {
  (blockNumber: number): Promise<void>;
}

export interface HandleError {
  (error: Error, context: EventContext, errorHandling: any): Promise<void>;
}

export interface BuyerRequestHandleError {
  (error: Error, context: BuyerRequestEventContext, errorHandling: any): Promise<void>;
}

export interface BuyerRequestSyncOptions {
  port?: number;
  address: string;
  providerHost?: string;
  abiVersion: number;
  fetchAll?: boolean;
  fromBlockNumber?: number;
  fetchLastKnownBlockNumber?: () => Promise<number>;
  buyerRequestCollection?: any;
  buyerRequestHandler: (buyerRequest: BuyerRequest, event: any) => Promise<void>;
  errorHandling: any;
  broadcastOptions?: BroadcastOptions;
  getBuyerRequestUpdatedAt?: GetBuyerRequestUpdatedAt;
}

export interface FetchBuyerRequestFromURL {
  (event: BuyerRequestEventDetails, errorHandling: any): Promise<any>;
}

export interface BuyerRequestHandler {
  (request: BuyerRequest, event: BuyerRequestEventDetails): Promise<void>;
}

export interface GetBuyerRequestUpdatedAt {
  (requestId: string): Promise<string>;
}
