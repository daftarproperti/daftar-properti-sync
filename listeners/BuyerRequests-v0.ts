import { Contract, EventLog, Log } from 'ethers';
import { FetchBuyerRequestFromURL, BuyerRequestHandler, BuyerRequestWithRetries, WriteBlockNumberToFile, HandleError, GetBuyerRequestUpdatedAt } from '../interfaces';
import { BuyerRequestEventDetails, Filter } from '../types';
import { Broadcaster } from '../broadcast/broadcaster';
import { isAfter, parseISO } from 'date-fns';

function isEventLog(event: EventLog | Log): event is EventLog {
    return 'args' in event;
}

export async function shouldIgnore(buyerRequestId: string, eventUpdatedAt: number, getBuyerRequestUpdatedAt: GetBuyerRequestUpdatedAt): Promise<boolean> {
    const buyerRequestUpdatedAt = await getBuyerRequestUpdatedAt(buyerRequestId);
    if (!buyerRequestUpdatedAt) {
        return false;
    }

    const existingUpdatedAt = parseISO(buyerRequestUpdatedAt);

    return existingUpdatedAt && !isAfter(eventUpdatedAt, existingUpdatedAt);
}

export async function fetchPastRequestsV0(
    blockNumber: number,
    contract: Contract,
    buyerRequestHandler: BuyerRequestHandler,
    withRetries: BuyerRequestWithRetries,
    writeBlockNumberToFile: WriteBlockNumberToFile,
    errorHandling: any,
    broadcaster: Broadcaster | null,
    getBuyerRequestUpdatedAt: GetBuyerRequestUpdatedAt | null
): Promise<void> {
    const eventTypes = [
        { name: 'NewBuyerRequest', operationType: 'ADD' },
        { name: 'BuyerRequestUpdated', operationType: 'UPDATE' },
        { name: 'BuyerRequestDeleted', operationType: 'DELETE' },
    ]

    let allEvents: Array<{
        args: BuyerRequestEventDetails;
        blockNumber: number;
        operationType: string;
    }> = [];

    for (const eventType of eventTypes) {
        const events = blockNumber === 0
            ? await contract.queryFilter(eventType.name)
            : await contract.queryFilter(eventType.name, blockNumber);

        const typedEvents = events.filter(isEventLog).map(event => {
            const { id, submitter, cityId, title, filter, timestamp } = event.args as unknown as BuyerRequestEventDetails;
            return {
                args: { id, submitter, cityId, title, filter, timestamp, blockNumber: event.blockNumber },
                blockNumber: event.blockNumber,
                operationType: eventType.operationType
            };
        });

        allEvents.push(...typedEvents);
    }

    allEvents.sort((a, b) => a.blockNumber - b.blockNumber);
    for (const event of allEvents) {
        console.debug(`Processing ${event.operationType} event for buyer request id: ${event.args.id} in block number: ${event.blockNumber}`);

        if (getBuyerRequestUpdatedAt && await shouldIgnore(event.args.id, event.args.timestamp, getBuyerRequestUpdatedAt)) {
            console.debug(`BuyerRequest id: ${event.args.id} is not newer. Skipping update.`);
            continue;
        }

        await withRetries(async () => {
            const eventObj = {
                id: event.args.id,
                submitter: event.args.submitter,
                cityId: event.args.cityId,
                title: event.args.title,
                filter: event.args.filter,
                timestamp: event.args.timestamp,
                blockNumber: event.blockNumber,
                operationType: event.operationType,
            };

            const buyerRequest = {
                buyerRequestId: Number(event.args.id),
                buyerRequestIdStr: event.args.id,
                submitter: event.args.submitter,
                cityId: Number(event.args.cityId),
                title: event.args.title,
                filter: event.args.filter,
                createdAt: event.args.timestamp,
                updatedAt: event.args.timestamp,
                blockNumber: event.blockNumber,
            };

            await buyerRequestHandler(buyerRequest, eventObj);
            await writeBlockNumberToFile(event.blockNumber);
        }, {
            blockNumber: event.blockNumber,
        }, errorHandling);
    }
}

export function registerRequestV0Listener(
    contract: Contract,
    buyerRequestHandler: BuyerRequestHandler,
    withRetries: BuyerRequestWithRetries,
    writeBlockNumberToFile: WriteBlockNumberToFile,
    handleErr: HandleError,
    errorHandling: any,
    broadcaster: Broadcaster | null,
    getBuyerRequestUpdatedAt: GetBuyerRequestUpdatedAt | null
): void {
    let eventProcessing = Promise.resolve();

    // Remove existing listeners before adding new ones
    contract.removeAllListeners('NewBuyerRequest');
    contract.removeAllListeners('BuyerRequestUpdated');
    contract.removeAllListeners('BuyerRequestDeleted');

    const newRequestListener = (id: string, submitter: string, cityId: string, title: string, filter: Filter, timestamp: number, payload: any) => {
        eventProcessing = eventProcessing.then(async () => {
            console.debug(`received buyer request id: ${id} in block number: ${payload.log.blockNumber}`);

            if (getBuyerRequestUpdatedAt) {
                console.debug(`Buyer request id: ${id} is not newer. Skipping update.`);
                return;
            }

            await withRetries(async () => {
                const eventObj = {
                    id,
                    submitter,
                    cityId,
                    title,
                    filter,
                    timestamp,
                    blockNumber: payload.log.blockNumber,
                    operationType: 'ADD'
                };

                const buyerRequest = {
                    buyerRequestId: Number(id),
                    buyerRequestIdStr: id,
                    submitter: submitter,
                    cityId: Number(cityId),
                    title: title,
                    filter: filter,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    blockNumber: payload.log.blockNumber,
                };

                await buyerRequestHandler(buyerRequest, eventObj);
                await writeBlockNumberToFile(payload.log.blockNumber);
            }, {
                blockNumber: payload.log.blockNumber,
            }, errorHandling);
        }).catch(error => {
            handleErr(error, { blockNumber: payload.log.blockNumber, offChainLink: payload.log.offChainLink }, errorHandling);
        });
    }


    const requestUpdatedListener = (id: string, submitter: string, cityId: string, title: string, filter: Filter, timestamp: number, payload: any) => {
        eventProcessing = eventProcessing.then(async () => {
            console.debug(`received update for buyer request id: ${id} in block number: ${payload.log.blockNumber}`);

            if (getBuyerRequestUpdatedAt) {
                console.debug(`Buyer request id: ${id} is not newer. Skipping update.`);
                return;
            }

            await withRetries(async () => {
                const eventObj = {
                    id,
                    submitter,
                    cityId,
                    title,
                    filter,
                    timestamp,
                    blockNumber: payload.log.blockNumber,
                    operationType: 'UPDATE'
                };

                const buyerRequest = {
                    buyerRequestId: Number(id),
                    buyerRequestIdStr: id,
                    submitter: submitter,
                    cityId: Number(cityId),
                    title: title,
                    filter: filter,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    blockNumber: payload.log.blockNumber,
                };

                await buyerRequestHandler(buyerRequest, eventObj);
                await writeBlockNumberToFile(payload.log.blockNumber);
            }, {
                blockNumber: payload.log.blockNumber,
            }, errorHandling);
        }).catch(error => {
            handleErr(error, { blockNumber: payload.log.blockNumber, offChainLink: payload.log.offChainLink }, errorHandling);
        });
    };

    const requestDeletedListener = (id: string, submitter: string, cityId: string, title: string, filter: Filter, timestamp: number, payload: any) => {
        eventProcessing = eventProcessing.then(async () => {
            console.debug(`received deletion for buyer request id: ${id} in block number: ${payload.log.blockNumber}`);

            if (getBuyerRequestUpdatedAt) {
                console.debug(`Buyer request id: ${id} is not newer. Skipping update.`);
                return;
            }

            await withRetries(async () => {
                const buyerRequest = {
                    buyerRequestId: Number(id),
                    buyerRequestIdStr: id,
                    submitter: submitter,
                    cityId: Number(cityId),
                    title: title,
                    filter: filter,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    blockNumber: payload.log.blockNumber,
                };

                await buyerRequestHandler(buyerRequest, {
                    id,
                    submitter,
                    cityId,
                    title,
                    filter,
                    timestamp,
                    blockNumber: payload.log.blockNumber,
                    operationType: 'DELETE'
                });

                await writeBlockNumberToFile(payload.log.blockNumber);
            }, {
                blockNumber: payload.log.blockNumber,
            }, errorHandling);
        }).catch(error => {
            handleErr(error, { blockNumber: payload.log.blockNumber, offChainLink: payload.log.offChainLink }, errorHandling);
        });
    };

    contract.on('NewBuyerRequest', newRequestListener);
    contract.on('BuyerRequestUpdated', requestUpdatedListener);
    contract.on('BuyerRequestDeleted', requestDeletedListener);
}
