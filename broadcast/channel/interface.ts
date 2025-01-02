import { EventDetails, Listing } from "../../types";

export const AVAILABLE_CHANNELS = {
    TWITTER: "TWITTER",
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
    twitterOptions: TwitterOptions;
    channelOptions: ChannelOption[];
}

export interface ChannelOption {
    name: string,
    filter: Filter;
    transform: Transform;
    driverName: typeof AVAILABLE_CHANNELS[keyof typeof AVAILABLE_CHANNELS];
    driverOptions: TwitterDriverOptions | SampleDriverOptions;
}

export interface TwitterOptions {
    enabled: boolean;
}

export interface TwitterDriverOptions {
    appKey: string;
    appSecret: string;
    accessToken: string;
    accessSecret: string;
}

export interface SampleOptions {
    enabled: boolean;
}

export interface SampleDriverOptions {
    apiKey: string;
}