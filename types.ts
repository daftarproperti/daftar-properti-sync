import { Contract, Log } from 'ethers';
import { FetchListingFromURL, ListingHandler, WithRetries, WriteBlockNumberToFile, HandleError, GetListingUpdatedAt } from './interfaces';
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