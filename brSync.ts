import { getContract } from './contract';
import { ethers } from 'ethers';
import { buyerRequestWithRetries } from './fetch';
import { buyerRequestHandleErr } from './errorHandler';
import { fetchPastRequestsV0, registerRequestV0Listener } from './listeners/BuyerRequests-v0';
import { BuyerRequestSyncOptions, GetBuyerRequestUpdatedAt, BuyerRequestHandler } from './interfaces';
import express from 'express';
import fs from 'fs/promises';
import WebSocket from 'ws';
import { BuyerRequestEventDetails, FetchBuyerRequestsFunction, BuyerRequest, RegisterBuyerRequestListenerFunction } from './types';
import { BroadcastOptions } from './broadcast/interface';
import { Broadcaster } from './broadcast/broadcaster';

const app = express();

export class BuyerRequestSync {
    logs: string[] = [];
    lastProcessedBlock: number = 0;
    port: number;
    address: string;
    provider: any;
    providerHost: string;
    abiVersion: number;
    contract: any;
    fetchAll: boolean;
    fromBlockNumber: number;
    fetchLastKnownBlockNumber: (() => Promise<number>) | null;
    getBuyerRequestUpdatedAt: GetBuyerRequestUpdatedAt | null;
    buyerRequestCollection: any;
    buyerRequestHandler: BuyerRequestHandler;
    errorHandling: any;
    broadcaster: Broadcaster | null;
    broadcastOptions: BroadcastOptions | null;

    constructor(options: BuyerRequestSyncOptions) {
        this.port = options.port ?? 8081;
        this.address = options.address;
   
        this.providerHost = options.providerHost || "";
        
        this.provider = new ethers.WebSocketProvider(this.createWebSocket());

        this.abiVersion = options.abiVersion;
        this.contract = getContract('BuyerRequests', this.address, this.provider, this.abiVersion);

        this.fetchAll = options.fetchAll ?? false;
        this.fromBlockNumber = options.fromBlockNumber ?? 0;
        this.fetchLastKnownBlockNumber = options.fetchLastKnownBlockNumber ?? null;
        this.getBuyerRequestUpdatedAt = options.getBuyerRequestUpdatedAt ?? null;
        this.buyerRequestCollection = options.buyerRequestCollection;
        this.buyerRequestHandler = async (buyerRequest, event) => {
            await this.syncToMongo(this.buyerRequestCollection, buyerRequest, event);
            if (options.buyerRequestHandler && typeof options.buyerRequestHandler === 'function') {
                await options.buyerRequestHandler(buyerRequest, event);
            }
        };
        this.errorHandling = options.errorHandling;

        if (options.broadcastOptions) {
            this.broadcastOptions = options.broadcastOptions;
            this.broadcaster = new Broadcaster(options.broadcastOptions);
        } else {
            this.broadcastOptions = null;
            this.broadcaster = null;
        }
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
                this.contract = getContract('BuyerRequests', this.address, this.provider, this.abiVersion);
                reconnect();
            }, 3000);
        };
  
        webSocket.onerror = (error) => {
            console.log("WebSocket error: ", error);
        };
    
        return webSocket;
    }

    registerListeners() {
        const listenerMap: Record<number, RegisterBuyerRequestListenerFunction> = {
            0: registerRequestV0Listener
        };

        const registerListener = listenerMap[this.abiVersion];

        if (!registerListener) {
            throw new Error(`Unsupported abiVersion: ${this.abiVersion}`);
        }

        registerListener(
            this.contract,
            this.buyerRequestHandler,
            buyerRequestWithRetries,
            this.writeBlockNumberToFile.bind(this),
            buyerRequestHandleErr,
            this.errorHandling,
            this.broadcaster,
            this.getBuyerRequestUpdatedAt
        );
    }

    async syncToMongo(buyerRequestCollection: any, buyerRequest: BuyerRequest, event: BuyerRequestEventDetails): Promise<void> {
        if (!buyerRequestCollection) return;

        const filter = { buyerRequestId: buyerRequest.buyerRequestId };
        try {
            switch (event.operationType) {
                case 'DELETE':
                    const deleteResult = await buyerRequestCollection.deleteOne(filter);
                    if (deleteResult.deletedCount > 0) {
                        console.log(`Request ${buyerRequest.buyerRequestId} deleted from mongodb, block number ${event.blockNumber}`);
                    } else {
                        console.log(`Request ${buyerRequest.buyerRequestId} not found in mongodb for deletion, block number ${event.blockNumber}`);
                    }
                    break;

                case 'ADD':
                case 'UPDATE':
                    // Save block number by default to Request
                    buyerRequest.blockNumber = event.blockNumber;

                    const update = { $set: buyerRequest };
                    const options = { upsert: true };

                    const updateResult = await buyerRequestCollection.updateOne(filter, update, options);
                    if (updateResult.upsertedCount > 0) {
                        console.log(`Request ${buyerRequest.buyerRequestId} inserted to mongodb, block number ${event.blockNumber}`);
                    } else {
                        console.log(`Request ${buyerRequest.buyerRequestId} updated in mongodb, block number ${event.blockNumber}`);
                    }
                    break;

                default:
                    console.log(`Invalid operationType: ${event.operationType} for buyerRequest ${buyerRequest.buyerRequestId}, block number ${event.blockNumber}`);
            }
        } catch (error) {
            throw error;
        }
    }

    async fetchPastRequests(blockNumber: number = 0): Promise<void> {
        const fetchRequestsMap: Record<number, FetchBuyerRequestsFunction> = {
            0: fetchPastRequestsV0
        };

        const fetchPastRequestsFunc = fetchRequestsMap[this.abiVersion];

        await fetchPastRequestsFunc(
            blockNumber,
            this.contract,
            this.buyerRequestHandler,
            buyerRequestWithRetries,
            this.writeBlockNumberToFile.bind(this),
            this.errorHandling,
            this.broadcaster,
            this.getBuyerRequestUpdatedAt
        );
    }

    async fetchMissedRequests(): Promise<void> {
        let blockNumber = await this.readBlockNumberFromFile();
        if (this.fetchLastKnownBlockNumber) {
            blockNumber = await this.fetchLastKnownBlockNumber();
        }

        await this.fetchPastRequests(blockNumber);
    }

    async readBlockNumberFromFile(): Promise<number> {
        try {
            const data = await fs.readFile('./lastKnownBuyerRequestBlockNumber.txt', 'utf8');
            return data === '' ? 0 : parseInt(data, 10);
        } catch (err) {
            return 0;
        }
    }

    async writeBlockNumberToFile(blockNumber: number): Promise<void> {
        try {
            const data = await fs.readFile('./lastKnownBuyerRequestBlockNumber.txt', 'utf8');
            const lastKnownBlockNumber = parseInt(data, 10);

            if (lastKnownBlockNumber >= blockNumber) {
                return;
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
              }
        }

        this.lastProcessedBlock = blockNumber;
        await fs.writeFile('./lastKnownBuyerRequestBlockNumber.txt', blockNumber.toString(), { flag: 'w', encoding: 'utf8' });
    }

    async start(): Promise<void> {
        const originalConsoleLog = console.log;
        console.log = (...args: any[]) => {
            const logString = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
            this.logs.push(logString);
            originalConsoleLog.apply(console, args);
        };

        if (this.broadcaster) {
            await this.broadcaster.start();
        }

        if (this.fetchAll) {
            await this.fetchPastRequests(0);
        }

        if (this.fromBlockNumber !== 0) {
            await this.fetchPastRequests(this.fromBlockNumber);
        }

        await this.fetchMissedRequests();

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

export function createBuyerRequestSyncInstance(options: BuyerRequestSyncOptions): BuyerRequestSync {
    validateOptions(options);
    return new BuyerRequestSync(options);
}

function validateOptions(options: BuyerRequestSyncOptions): void {
    const requiredFields = ['providerHost', 'abiVersion', 'buyerRequestHandler'];
    for (const field of requiredFields) {
        if (!(field in options)) {
            throw new Error(`Required field '${field}' is missing in options.`);
        }
    }

    if (typeof options.abiVersion !== 'number' || isNaN(options.abiVersion)) {
        throw new Error(`Invalid 'abiVersion'. It must be a valid number`);
    }
}
