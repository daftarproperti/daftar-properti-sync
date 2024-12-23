import { BrokerOptions } from "./channel/interface";

export interface BroadcastOptions {
    mongoURI: string;
    mongoDatabase: string;
    brokerOptions: BrokerOptions;
}

