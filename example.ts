import { AVAILABLE_CHANNELS } from './broadcast/channel/interface';
import { createInstance } from './dpSync';
import dotenv from 'dotenv';
import { Listing } from './types';

dotenv.config();

type ListingHandler = (listing: Listing, event: any) => Promise<void>;
type ErrorHandler = (error: Error, context: any) => Promise<void>;
type FetchLastKnownBlockNumber = () => Promise<number>;

const listingHandler: ListingHandler = async (listing, event) => {
    console.log("Listing: ");
    console.log(listing);

    console.log("Event details: ");
    console.log(event);
};

const fetchLastKnownBlockNumber: FetchLastKnownBlockNumber = async () => {
    return 0;
};

const errorHandler: ErrorHandler = async (error, context) => {
    console.error(`Error occurred! Error: ${error}, context: ${context}`);
};

async function main(): Promise<void> {
    try {
        const INFURA_API_KEY = process.env.INFURA_API_KEY;
        const ERROR_NOTIF_CHANNEL = process.env.ERROR_NOTIF_CHANNEL;
        const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
        const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

        if (!INFURA_API_KEY || !ERROR_NOTIF_CHANNEL || !SLACK_WEBHOOK_URL || !CONTRACT_ADDRESS) {
            throw new Error("Missing environment variables. Please set INFURA_API_KEY, ERROR_NOTIF_CHANNEL, SLACK_WEBHOOK_URL, or CONTRACT_ADDRESS.");
        }

        const options = {
            port: 8080,
            address: CONTRACT_ADDRESS,
            fetchAll: false,
            strictHash: true,
            providerHost: `polygon-mainnet.infura.io/ws/v3/${INFURA_API_KEY}`,
            fromBlockNumber: 0,
            abiVersion: 1,
            fetchLastKnownBlockNumber: fetchLastKnownBlockNumber,
            listingHandler: listingHandler,
            errorHandling: {
                errorChannel: ERROR_NOTIF_CHANNEL,
                slackConfiguration: {
                    slackWebhookURL: SLACK_WEBHOOK_URL
                },
                errorHandler: errorHandler,
            },
            broadcastOptions: {
                // Replace this with desired mongoURI
                mongoURI: 'mongodb://localhost:27017',
                // Replace this with desired mongoDatabase
                mongoDatabase: 'test',
                brokerOptions: {
                    maxRetries: 2,
                    channelOptions: [
                        {
                            name: 'Test Twitter',
                            enabled: true,
                            filter: async (listing: Listing) => {
                                console.log("FILTERING LISTING . . . listing: ", listing);
                                return true;
                            },
                            transform: async (listing: Listing) => {
                                console.log("TRANSFORMING LISTING DESCRIPTION . . .");
                                return listing.description;
                            },
                            driverName: AVAILABLE_CHANNELS.TWITTER,
                            driverOptions: {
                                appKey: "YOUR_APP_KEY",
                                appSecret: "YOUR_APP_SECRET",
                                accessToken: "YOUR_ACCESS_TOKEN",
                                accessSecret: "YOUR_ACCESS_SECRET"
                            }
                        }
                    ]
                }
            }
        };

        const instance = createInstance(options);

        await instance.start();
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

main();
