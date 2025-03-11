import { MongoClient } from "mongodb";
import { BroadcastOptions } from "./interface";
import { Broker } from "./channel/broker";
import { BrokerOptions, STATUS } from "./channel/interface";
import { Agenda } from "@hokify/agenda";
import { Listing } from "../types";

export class Broadcaster {
    mongoURI: string;
    mongoDatabase: string;
    brokerOptions: BrokerOptions;

    agenda: any;
    broadcastCollection: any;
    broker?: Broker;

    constructor(options: BroadcastOptions) {
        this.mongoURI = options.mongoURI;
        this.mongoDatabase = options.mongoDatabase;
        this.brokerOptions = options.brokerOptions;
    }

    async retryFailedBroadcast(): Promise<void> {
        try {
            const failedBroadcasts = await this.broadcastCollection.find({ status: STATUS.FAILED }).toArray();

            for (const failedBroadcast of failedBroadcasts) {
                try {
                    console.log(`Retrying failed broadcast for event ID: ${failedBroadcast.event.id}`);
                    await this.broker?.retryBroadcast(failedBroadcast);
                } catch (error) {
                    console.error(`Error retrying broadcast for event ID: ${failedBroadcast.event.id}. error: `, error);
                }
            }
        } catch (error) {
            console.error("Error resending failed broadcast: ", error);
        }
    }

    async broadcast(listing: Listing, event: any): Promise<string> {
        if (!event) {
            console.log(`No event submitted, aborting broadcast`);
            return '';
        }

        if (event.operationType != 'ADD' && event.operationType != 'UPDATE') {
            console.log(`Invalid event type. Only ADD and UPDATE are allowed`);
            return '';
        }

        const sanitizedListing = this.sanitizeInput(listing);
        const sanitizedEvent = this.sanitizeInput(event);

        try {
            const job = await this.agenda.now('broadcast', { listing: sanitizedListing, event: sanitizedEvent });
            return job.attrs._id.toHexString();
        } catch (error) {
            console.error(`Error queueing broadcast job for block number: ${event.blockNumber}, listing id: ${listing.listingIdStr}. error:  `, error);
            return '';
        }
    }

    async start(): Promise<void> {
        const client = new MongoClient(this.mongoURI);
        await client.connect();
        
        const database = client.db(this.mongoDatabase);

        const mongoURI = new URL(this.mongoURI);
        mongoURI.pathname = `/${this.mongoDatabase}`;
        this.agenda = new Agenda({ db: { address: `${mongoURI.toString()}`, collection: 'agenda' } });
        this.agenda.define('broadcast', async (job: any) => {
            const { listing, event } = job.attrs.data;
            console.log(`Processing broadcast job: ${JSON.stringify({ listing, event })}`);

            try {
                await this.broker?.broadcast(event, listing);
            } catch (error) {
                console.error("Error in broadcast job: ", error);
            }
        });

        this.broadcastCollection = database.collection('broadcast');

        this.broker = new Broker(this.agenda, this.broadcastCollection, this.brokerOptions);

        await this.agenda.start();
        // Retries sometimes cause account suspension, disable for now.
        // TODO: Enable this when things are stabilized.
        // await this.retryFailedBroadcast();
    }

    private sanitizeInput(input: any) {
        // Since BSON Serializer does not natively support BigINT, sanitize the value
        const sanitizeField = (value: any): any => {
            if (typeof value === "bigint") {
                return value.toString();
            }
            if (typeof value === "number" && !Number.isSafeInteger(value)) {
                return value.toString();
            }

            if (typeof value === "object" && value !== null) {
                for (const key in value) {
                    value[key] = sanitizeField(value[key]);
                }
            }
            return value;
        };

        return sanitizeField({ ...input });
    }
}
