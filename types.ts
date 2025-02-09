import { Contract, Log } from 'ethers';
import {
  FetchListingFromURL, ListingHandler, WithRetries, HandleError, GetListingUpdatedAt,
  FetchBuyerRequestFromURL, BuyerRequestHandler, BuyerRequestWithRetries, BuyerRequestHandleError, GetBuyerRequestUpdatedAt,
  WriteBlockNumberToFile,
 } from './interfaces';
import { Broadcaster } from './broadcast/broadcaster';

export interface Listing {
  listingId: number;
  listingIdStr: string;
  blockNumber: number;
  propertyType: string;
  listingForSale: boolean;
  listingForRent: boolean;
  address: string;
  description: string;
  price: number;
  rentPrice: number;
  lotSize: number;
  buildingSize: number;
  carCount: number;
  bedroomCount: number;
  bathroomCount: number;
  floorCount: number;
  electricPower: number | null;
  facing: string;
  ownership: string;
  isVerified: boolean;
  cityName: string;
  cityId: number;
  pictureUrls: string[];
  coordinate: Coordinate;
  withRewardAgreement: boolean;
  isMultipleUnits: boolean;
  createdAt: string;
  updatedAt: string;
  registrant: Registrant;

  // Indicates approval status of a Listing
  // True when a Listing has been disapproved after being added to blockchain. False when it is just added or reapproved
  isInvalidated: boolean;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Registrant {
  name: string;
  phoneNumberEncrypted: string;
  phoneNumberHash: string;
  delegatePhoneHash: string | null;
  profilePictureURL: string | null;
  company: string | null;
}

export interface BuyerRequest {
  buyerRequestId: number;
  buyerRequestIdStr: string;
  blockNumber: number;
  submitter: string;
  cityId: number;
  title: string;
  filter: Filter;
  createdAt: number;
  updatedAt: number;
}

export interface Filter {
  city: string;
  propertyType: string;
  listingType: string;
  facing: string;
  ownership: string;
  price: MinMaxNumber;
  lotSize: MinMaxNumber;
  bedroomCount: MinNumberOnly;
  bathroomCount: MinNumberOnly;
  carCount: MinNumberOnly;
  floorCount: number;
  electricPower: number;
}

export interface MinMaxNumber {
  min: number;
  max: number;
}

export interface MinNumberOnly {
  min: number;
}

export interface BuyerRequestEventDetails {
  id: string;
  submitter: string;
  cityId: string;
  title: string;
  filter: Filter;
  timestamp: number;
  blockNumber: number;
  operationType?: string;
}

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

export interface BuyerRequestEventContext {
  blockNumber: number;
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
    errorHandling: any,
    broadcaster: Broadcaster | null,
    fetchListingUpdatedAt: GetListingUpdatedAt | null
) => Promise<void>;

export type RegisterListenerFunction = (
    contract: Contract,
    getListingFromURL: FetchListingFromURL,
    listingHandler: ListingHandler,
    withRetries: WithRetries,
    writeBlockNumberToFile: WriteBlockNumberToFile,
    handleErr: HandleError,
    strictHash: boolean,
    errorHandling: any,
    broadcaster: Broadcaster | null,
    fetchListingUpdatedAt: GetListingUpdatedAt | null
) => void;

export type FetchBuyerRequestsFunction = (
    blockNumber: number,
    contract: Contract,
    buyerRequestHandler: BuyerRequestHandler,
    withRetries: BuyerRequestWithRetries,
    writeBlockNumberToFile: WriteBlockNumberToFile,
    errorHandling: any,
    broadcaster: Broadcaster | null,
    fetchBuyerRequestUpdatedAt: GetBuyerRequestUpdatedAt | null
) => Promise<void>;

export type RegisterBuyerRequestListenerFunction = (
    contract: Contract,
    buyerRequestHandler: BuyerRequestHandler,
    withRetries: BuyerRequestWithRetries,
    writeBlockNumberToFile: WriteBlockNumberToFile,
    handleErr: BuyerRequestHandleError,
    errorHandling: any,
    broadcaster: Broadcaster | null,
    fetchBuyerRequestUpdatedAt: GetBuyerRequestUpdatedAt | null
) => void;