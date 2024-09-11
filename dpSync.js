const { getContract } = require("./contract");
const { getListingFromURL, withRetries } = require("./fetch");
const { handleErr } = require("./errorHandler");
const fs = require('fs').promises;

const express = require('express');
const app = express();

const { fetchPastListingsV0, registerV0Listener } = require('./listeners/v0');
const { fetchPastListingsV1, registerV1Listener } = require('./listeners/v1');

/**
 * Daftar Properti synchronizer abstracts away the details of how to get the blockchain events
 * and let users supply just a handler to listen for those events.
 *
 * @description
 * Common use cases:
 *
 * - Supply `options.listingHandler` to listen for listing events and act accordingly,
 *   e.g. sync to custom DB, send notification, etc.
 * - Supply `options.listingCollection` which is a mongodb Collection and keep raw
 *   listings data.
 */
class DaftarPropertiSync {
    /**
     * Creates an instance of Daftar Properti synchronizer.
     *
     * @param {Object} options - The options for configuring the DaftarPropertiSync instance.
     * @param {Collection} [options.collection] - The mongodb collection to sync to.
     * @param {Function} [options.listingHandler] - Async function to handle listing events.
     */
    constructor(options) {
        this.logs = [];
        this.lastProcessedBlock = 0;
        this.port = options.port ?? 8080;

        this.address = options.address;
        this.strictHash = options.strictHash;
        this.provider = options.provider;
        this.abiVersion = options.abiVersion;
        this.contract = getContract(this.address, this.provider, this.abiVersion);

        this.fetchAll = options.fetchAll ?? false;
        this.fromBlockNumber = options.fromBlockNumber ?? 0;
        this.fetchLastKnownBlockNumber = options.fetchLastKnownBlockNumber ?? null;

        this.listingCollection = options.listingCollection;
        // To handle a listing event, we do built-in handler first (mongo)
        // and then the user supplied custom handler.
        this.listingHandler = async (listing, event) => {
            await this.syncToMongo(this.listingCollection, listing, event);
            await options.listingHandler(listing, event);
        };
        this.errorHandling = options.errorHandling;
    }

    async syncToMongo(listingCollection, listing, event) {
        if (!listingCollection) return;

        const filter = { listingId: listing.listingId };
        try {
            switch (event.operationType) {
                case "DELETE":
                    const deleteResult = await listingCollection.deleteOne(filter);
                    if (deleteResult.deletedCount > 0) {
                        console.log(`Listing ${listing.listingId} deleted from mongodb, block number ${event.blockNumber}`);
                    } else {
                        console.log(`Listing ${listing.listingId} not found in mongodb for deletion, block number ${event.blockNumber}`);
                    }
                    break;
    
                case "ADD":
                case "UPDATE":
                    const update = { $set: listing };
                    const options = { upsert: true };
                    
                    const updateResult = await listingCollection.updateOne(filter, update, options);
                    if (updateResult.upsertedCount > 0) {
                        console.log(`Listing ${listing.listingId} inserted to mongodb, block number ${event.blockNumber}`);
                    } else {
                        console.log(`Listing ${listing.listingId} updated in mongodb, block number ${event.blockNumber}`);
                    }
                    break;
    
                default:
                    console.log(`Invalid operationType: ${event.operationType} for listing ${listing.listingId}, block number ${event.blockNumber}`);
            }
        } catch (error) {
            throw (error);
        }
    }

    async fetchPastListings(blockNumber = 0) {
        const fetchListingsMap = {
            0: fetchPastListingsV0,
            1: fetchPastListingsV1
        };
        
        const fetchPastListings = fetchListingsMap[this.abiVersion];

        if (!fetchPastListings) {
            throw new Error(`Unsupported abiVersion: ${this.abiVersion}`);
        }

        await fetchPastListings(
            blockNumber,
            this.contract,
            getListingFromURL,
            this.listingHandler,
            withRetries,
            this.writeBlockNumberToFile.bind(this),
            handleErr,
            this.strictHash,
            this.errorHandling
        );
    }

    async fetchMissedListings() {
        const blockNumber = await this.readBlockNumberFromFile();
        if (this.fetchLastKnownBlockNumber) {
            blockNumber = await this.fetchLastKnownBlockNumber();
        }

        await this.fetchPastListings(blockNumber);
    }

    async readBlockNumberFromFile() {
        try {
            const data = await fs.readFile('./lastKnownBlockNumber.txt', 'utf8');
            return data === '' ? 0 : parseInt(data, 10);
        } catch (err) {
            return 0;
        }
    }

    async writeBlockNumberToFile(blockNumber) {
        try {
            const data = await fs.readFile('./lastKnownBlockNumber.txt', 'utf8');
            const lastKnownBlockNumber = parseInt(data, 10);

            if (lastKnownBlockNumber >= blockNumber) {
                console.debug('Skipping write: Block number in file is greater or equal to the current block number.');
                return;
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        this.lastProcessedBlock = blockNumber;
        await fs.writeFile('./lastKnownBlockNumber.txt', blockNumber.toString(), { flag: 'w', encoding: 'utf8' });
        console.debug('Block number written to file:', blockNumber);
    }

    async start() {
        const originalConsoleLog = console.log;
        console.log = (...args) => {
            const logString = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
            this.logs.push(logString);
            originalConsoleLog.apply(console, args);
        };

        if (this.fetchAll) {
            await this.fetchPastListings(0);
        }

        if (this.fromBlockNumber !== 0) {
            await this.fetchPastListings(this.fromBlockNumber);
        }

        await this.fetchMissedListings();

        const listenerMap = {
            0: registerV0Listener,
            1: registerV1Listener
        };
    
        const registerListener = listenerMap[this.abiVersion];
        
        if (!registerListener) {
            throw new Error(`Unsupported abiVersion: ${this.abiVersion}`);
        }
    
        registerListener(
            this.contract,
            getListingFromURL,
            this.listingHandler,
            withRetries,
            this.writeBlockNumberToFile.bind(this),
            handleErr,
            this.strictHash,
            this.errorHandling
        );

        app.listen(this.port, () => {
            console.log(`Web interface running at http://localhost:${this.port}`);
        });

        app.get('/', (req, res) => {
            res.send(`
                <html>
                <head><title>Console Logs</title></head>
                <body>
                    <h1>Console Logs:</h1>
                    <pre>${this.logs.join('\n')}</pre>
                </body>
                </html>
            `);
        });

        app.get('/health', (req, res) => {
            const healthStatus = {
                status: 'healthy',
                lastProcessedBlock: this.lastProcessedBlock
            };
            res.json(healthStatus);
        });
    }
}

function createInstance(options) {
    validateOptions(options);
    return new DaftarPropertiSync(options);
}

function validateOptions(options) {
    const requiredFields = ['provider', 'abiVersion','listingHandler'];
    for (const field of requiredFields) {
        if (!(field in options)) {
            throw new Error(`Required field '${field}' is missing in options.`);
        }
    }

    // Sanitize AbiVersion options
    if (typeof options.abiVersion !== 'number' || isNaN(options.abiVersion)) {
        throw new Error(`Invalid 'abiVersion'. It must be a valid number`);
    }
}

module.exports = {
    createInstance
};
