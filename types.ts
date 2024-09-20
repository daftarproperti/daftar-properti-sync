import { Contract, Log } from 'ethers';
import { FetchListingFromURL, ListingHandler, WithRetries, WriteBlockNumberToFile, HandleError } from './interfaces';

export interface EventDetails {
  id: string;
  cityId: string;
  offChainLink: string;
  dataHash: string;
  timestamp: number;
  blockNumber: number;
  operationType?: string;
}

export interface EventContext {
  blockNumber: number;
  offChainLink: string;
}

export interface Event extends Log {
  args: {
    id: string;
    cityId: string;
    offChainLink: string;
    dataHash: string;
    timestamp: number;
  };
  blockNumber: number;
}

export type FetchListingsFunction = (
    blockNumber: number,
    contract: Contract,
    getListingFromURL: FetchListingFromURL,
    listingHandler: ListingHandler,
    withRetries: WithRetries,
    writeBlockNumberToFile: WriteBlockNumberToFile,
    strictHash: boolean,
    errorHandling: any
) => Promise<void>;

export type RegisterListenerFunction = (
    contract: Contract,
    getListingFromURL: FetchListingFromURL,
    listingHandler: ListingHandler,
    withRetries: WithRetries,
    writeBlockNumberToFile: WriteBlockNumberToFile,
    handleErr: HandleError,
    strictHash: boolean,
    errorHandling: any
) => void;