import { EventDetails, Listing } from "../../types";

export const AVAILABLE_CHANNELS = {
    TWITTER: "TWITTER",
    INSTAGRAM: "INSTAGRAM",
} as const;

export const STATUS = {
    SUCCESS: "SUCCESS",
    PENDING: "PENDING",
    FAILED: "FAILED",
}

export interface Filter {
    (listing: Listing, event: EventDetails): Promise<boolean>;
}

export interface Transform {
    (listing: Listing): Promise<string>;
}

export interface BrokerOptions {
    maxRetries: number;
    channelOptions: ChannelOption[];
}

export type ChannelType = typeof AVAILABLE_CHANNELS[keyof typeof AVAILABLE_CHANNELS];

export interface BaseChannelOption {
    enabled: boolean,
    name: string,
    filter: Filter;
    transform: Transform;
}

export interface TwitterChannelOption extends BaseChannelOption {
  driverName: typeof AVAILABLE_CHANNELS.TWITTER;
  driverOptions: TwitterDriverOptions;
}

export interface InstagramChannelOption extends BaseChannelOption {
  driverName: typeof AVAILABLE_CHANNELS.INSTAGRAM;
  driverOptions: InstagramDriverOptions;
}

export type ChannelOption = TwitterChannelOption | InstagramChannelOption;

export interface TwitterDriverOptions {
    appKey: string;
    appSecret: string;
    accessToken: string;
    accessSecret: string;
}

export interface InstagramDriverOptions {
    accessToken: string;
    instagramAccountId: string;
}

export interface SampleOptions {
    enabled: boolean;
}

export interface SampleDriverOptions {
    apiKey: string;
}
