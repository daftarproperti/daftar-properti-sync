import { BrokerOptions } from "./channel/interface";

export interface BroadcastOptions {
    port: number;
    mongoURI: string;
    mongoDatabase: string;
    brokerOptions: BrokerOptions;
}

