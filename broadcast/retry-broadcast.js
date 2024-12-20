import { MongoClient } from "mongodb";
import { Agenda } from "@hokify/agenda";
import { Broker } from '../js-generated/broadcast/channel/broker.js';
import { AVAILABLE_CHANNELS, STATUS } from "../js-generated/broadcast/channel/interface.js";

// MongoDB Configuration
const MONGO_COLLECTION_NAME = "broadcast";

const option = {
    // Replace this with desired mongoURI
    mongoURI: 'mongodb://localhost:27017',
    // Replace this with desired mongoDatabase
    mongoDatabase: 'test',
    brokerOptions: {
        maxRetries: 5,
        twitterOptions: {
            enabled: true,
            
        },
        channelOptions: [
            {
                name: 'Test Twitter',
                filter: async (listing) => {
                    console.log("FILTERING LISTING . . .");
                    return true;
                },
                transform: async (listing) => {
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
};

async function main() {
    console.log("Starting broadcasting retry . . .");

    try {
        const client = new MongoClient(option.mongoURI);
        await client.connect();

        const db = client.db(option.mongoDatabase);
        const broadcastCollection = db.collection(MONGO_COLLECTION_NAME);

        const agenda = new Agenda({ db: { address: option.mongoURI, collection: 'agenda' } });
        const broker = new Broker(agenda, broadcastCollection, option.brokerOptions);

        await agenda.start();

        const failedBroadcasts = await broadcastCollection.find({ status: STATUS.FAILED }).toArray();

        for (const failedBroadcast of failedBroadcasts) {
            try {
                console.log(`Retrying failed broadcast for event ID: ${failedBroadcast.event.id}`);
                await broker.retryBroadcast(failedBroadcast);
            } catch (error) {
                console.error(`Error retrying broadcast for event ID: ${failedBroadcast.event.id}. error: `, error);
            }
        }
    } catch (error) {
        console.error("Error retrying broadcast. error: ", error);
    }
}

main().catch((error) => {
    console.error('Error in main:', error);
});