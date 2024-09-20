import { createInstance } from './dpSync';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

type ListingHandler = (listing: any, event: any) => Promise<void>;
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

        const provider = new ethers.WebSocketProvider(`wss://polygon-mainnet.infura.io/ws/v3/${INFURA_API_KEY}`);

        const options = {
            port: 8080,
            provider: provider,
            address: CONTRACT_ADDRESS,
            fetchAll: false,
            strictHash: true,
            fromBlockNumber: 0,
            abiVersion: 0,
            fetchLastKnownBlockNumber: fetchLastKnownBlockNumber,
            listingHandler: listingHandler,
            errorHandling: {
                errorChannel: ERROR_NOTIF_CHANNEL,
                slackConfiguration: {
                    slackWebhookURL: SLACK_WEBHOOK_URL
                },
                errorHandler: errorHandler,
            },
        };

        const instance = createInstance(options);

        await instance.start();
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

main();
