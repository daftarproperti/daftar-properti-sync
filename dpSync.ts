import { getContract } from './contract';
import { ethers } from 'ethers';
import { getListingFromURL, withRetries } from './fetch';
import { handleErr } from './errorHandler';
import { fetchPastListingsV0, registerV0Listener } from './listeners/v0';
import { fetchPastListingsV1, registerV1Listener } from './listeners/v1';
import { DaftarPropertiSyncOptions, ListingHandler } from './interfaces';
import express from 'express';
import fs from 'fs/promises';
import WebSocket from 'ws';
import { FetchListingsFunction, RegisterListenerFunction } from './types';

const app = express();

export class DaftarPropertiSync {
    logs: string[] = [];
    lastProcessedBlock: number = 0;
    port: number;
    address: string;
    strictHash: boolean;
    provider: any;
    providerHost: string;
    abiVersion: number;
    contract: any;
    fetchAll: boolean;
    fromBlockNumber: number;
    fetchLastKnownBlockNumber: (() => Promise<number>) | null;
    listingCollection: any;
    listingHandler: ListingHandler;
    errorHandling: any;

    constructor(options: DaftarPropertiSyncOptions) {
        this.port = options.port ?? 8080;
        this.address = options.address;
        this.strictHash = options.strictHash;
   
        this.providerHost = options.providerHost || "";
        
        this.provider = new ethers.WebSocketProvider(this.createWebSocket());

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

    createWebSocket() {
        const reconnect = () => {
            this.registerListeners();
            console.log('Reconnected to websocket');
        };

        const webSocket = new WebSocket(`wss://`+this.providerHost);
  
        webSocket.onclose = () => {
            console.log("Websocket disconnected. Reconnecting . . .");
            setTimeout(() => {
                this.provider = new ethers.WebSocketProvider(this.createWebSocket());
                this.contract = getContract(this.address, this.provider, this.abiVersion);
                reconnect();
            }, 3000);
        };
  
        webSocket.onerror = (error) => {
            console.log("WebSocket error: ", error);
        };
    
        return webSocket;
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
    const requiredFields = ['providerHost', 'abiVersion', 'listingHandler'];
    for (const field of requiredFields) {
        if (!(field in options)) {
            throw new Error(`Required field '${field}' is missing in options.`);
        }
    }

    if (typeof options.abiVersion !== 'number' || isNaN(options.abiVersion)) {
        throw new Error(`Invalid 'abiVersion'. It must be a valid number`);
    }
}
