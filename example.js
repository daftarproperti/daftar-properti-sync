const { createInstance } = require('./dp-sync/dpSync');
const { ethers } = require('ethers');
require('dotenv').config();

async function listingHandler(listing, event) {
    console.log("Listing: ");
    console.log(listing);

    console.log("event details: ");
    console.log(event);
}

async function fetchLastKnownBlockNumber() {
    return 0;
}

async function errorHandler(error, context) {
    console.error(`error occured! error: ${error}, context: ${context} `);
}

async function main() {
    try {
        const provider = new ethers.WebSocketProvider(`wss://polygon-mainnet.infura.io/ws/v3/${INFURA_API_KEY}`);

        const options = {
            port: 8080,
            provider: provider,
            fetchAll: false,
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
