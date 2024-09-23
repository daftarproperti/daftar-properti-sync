import { getContract } from './contract';
import { getListingFromURL, withRetries } from './fetch';
import { handleErr } from './errorHandler';
import { fetchPastListingsV0, registerV0Listener } from './listeners/v0';
import { fetchPastListingsV1, registerV1Listener } from './listeners/v1';
import { DaftarPropertiSyncOptions, ListingHandler } from './interfaces';
import express from 'express';
import fs from 'fs/promises';
import { FetchListingsFunction, RegisterListenerFunction } from './types';

const app = express();

export class DaftarPropertiSync {
    logs: string[] = [];
    lastProcessedBlock: number = 0;
    port: number;
    address: string;
    strictHash: boolean;
    provider: any;
    abiVersion: number;
    contract: any;
    fetchAll: boolean;
    fromBlockNumber: number;
    fetchLastKnownBlockNumber: (() => Promise<number>) | null;
    listingCollection: any;
    listingHandler: ListingHandler;
    errorHandling: any;

    private currentListeners: any[] = [];

    constructor(options: DaftarPropertiSyncOptions) {
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
        this.listingHandler = async (listing, event) => {
            await this.syncToMongo(this.listingCollection, listing, event);
            await options.listingHandler(listing, event);
        };
        this.errorHandling = options.errorHandling;
    }

    initializeWebSocket() {
        const reconnect = () => {
            console.warn('Reconnecting to websocket . . .');

            this.currentListeners.forEach(unregister => unregister());
            this.currentListeners = [];
            
            this.registerListeners();
        };

        this.provider._websocket.on('close', () => {
            console.error('WebSocket connection closed.');

            // Reconnect after 5 seconds to wait for pending tasks to finish
            setTimeout(reconnect, 5000);
        });

        this.provider._websocket.on('error', (err: Error) => {
            console.error('WebSocket error:', err);

            // Reconnect after 5 seconds to wait for pending tasks to finish
            setTimeout(reconnect, 5000);
        });
    }

    registerListeners() {
        const listenerMap: Record<number, RegisterListenerFunction> = {
            0: registerV0Listener,
            1: registerV1Listener
        };

        const registerListener = listenerMap[this.abiVersion];

        if (!registerListener) {
            throw new Error(`Unsupported abiVersion: ${this.abiVersion}`);
        }

        const unregister = registerListener(
            this.contract,
            getListingFromURL,
            this.listingHandler,
            withRetries,
            this.writeBlockNumberToFile.bind(this),
            handleErr,
            this.strictHash,
            this.errorHandling
        );
    
        this.currentListeners.push(unregister);
    }

    async syncToMongo(listingCollection: any, listing: any, event: any): Promise<void> {
        if (!listingCollection) return;

        const filter = { listingId: listing.listingId };
        try {
            switch (event.operationType) {
                case 'DELETE':
                    const deleteResult = await listingCollection.deleteOne(filter);
                    if (deleteResult.deletedCount > 0) {
                        console.log(`Listing ${listing.listingId} deleted from mongodb, block number ${event.blockNumber}`);
                    } else {
                        console.log(`Listing ${listing.listingId} not found in mongodb for deletion, block number ${event.blockNumber}`);
                    }
                    break;

                case 'ADD':
                case 'UPDATE':
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
            throw error;
        }
    }

    async fetchPastListings(blockNumber: number = 0): Promise<void> {
        const fetchListingsMap: Record<number, FetchListingsFunction> = {
            0: fetchPastListingsV0,
            1: fetchPastListingsV1
        };

        const fetchPastListingsFunc = fetchListingsMap[this.abiVersion];

        await fetchPastListingsFunc(
            blockNumber,
            this.contract,
            getListingFromURL,
            this.listingHandler,
            withRetries,
            this.writeBlockNumberToFile.bind(this),
            this.strictHash,
            this.errorHandling
        );
    }

    async fetchMissedListings(): Promise<void> {
        let blockNumber = await this.readBlockNumberFromFile();
        if (this.fetchLastKnownBlockNumber) {
            blockNumber = await this.fetchLastKnownBlockNumber();
        }

        await this.fetchPastListings(blockNumber);
    }

    async readBlockNumberFromFile(): Promise<number> {
        try {
            const data = await fs.readFile('./lastKnownBlockNumber.txt', 'utf8');
            return data === '' ? 0 : parseInt(data, 10);
        } catch (err) {
            return 0;
        }
    }

    async writeBlockNumberToFile(blockNumber: number): Promise<void> {
        try {
            const data = await fs.readFile('./lastKnownBlockNumber.txt', 'utf8');
            const lastKnownBlockNumber = parseInt(data, 10);

            if (lastKnownBlockNumber >= blockNumber) {
                console.debug('Skipping write: Block number in file is greater or equal to the current block number.');
                return;
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
              }
        }

        this.lastProcessedBlock = blockNumber;
        await fs.writeFile('./lastKnownBlockNumber.txt', blockNumber.toString(), { flag: 'w', encoding: 'utf8' });
        console.debug('Block number written to file:', blockNumber);
    }

    async start(): Promise<void> {
        const originalConsoleLog = console.log;
        console.log = (...args: any[]) => {
            const logString = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
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

        this.registerListeners();

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

export function createInstance(options: DaftarPropertiSyncOptions): DaftarPropertiSync {
    validateOptions(options);
    return new DaftarPropertiSync(options);
}

function validateOptions(options: DaftarPropertiSyncOptions): void {
    const requiredFields = ['provider', 'abiVersion', 'listingHandler'];
    for (const field of requiredFields) {
        if (!(field in options)) {
            throw new Error(`Required field '${field}' is missing in options.`);
        }
    }

    if (typeof options.abiVersion !== 'number' || isNaN(options.abiVersion)) {
        throw new Error(`Invalid 'abiVersion'. It must be a valid number`);
    }
}
