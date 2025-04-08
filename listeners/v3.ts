import { Contract, EventLog, Log } from 'ethers';
import { FetchListingFromURL, ListingHandler, WithRetries, WriteBlockNumberToFile, HandleError, GetListingUpdatedAt } from '../interfaces';
import { EventDetails } from '../types';
import { Broadcaster } from '../broadcast/broadcaster';
import { isAfter, parseISO } from 'date-fns';

function isEventLog(event: EventLog | Log): event is EventLog {
    return 'args' in event;
}

export async function shouldIgnore(listingId: string, offChainLink: string, getListingUpdatedAt: GetListingUpdatedAt): Promise<boolean> {
    const listingUpdatedDate = offChainLink.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/)?.[0];
    if (!listingUpdatedDate) {
        console.warn(`No valid date found in offChainLink: ${offChainLink}`);
        return false;
    }

    const eventUpdatedAt = parseISO(listingUpdatedDate);

    const listingUpdatedAt = await getListingUpdatedAt(listingId);
    if (!listingUpdatedAt) {
        return false;
    }

    const existingUpdatedAt = parseISO(listingUpdatedAt);

    if (existingUpdatedAt && !isAfter(eventUpdatedAt, existingUpdatedAt)) {
        return true;
    }

    return false;
}

export async function fetchPastListingsV3(
    blockNumber: number,
    contract: Contract,
    getListingFromURL: FetchListingFromURL,
    listingHandler: ListingHandler,
    withRetries: WithRetries,
    writeBlockNumberToFile: WriteBlockNumberToFile,
    strictHash: boolean,
    errorHandling: any,
    broadcaster: Broadcaster | null,
    getListingUpdatedAt: GetListingUpdatedAt | null
): Promise<void> {
    const eventTypes = [
        { name: 'NewListing', operationType: 'ADD' },
        { name: 'ListingUpdated', operationType: 'UPDATE' },
        { name: 'ListingDeleted', operationType: 'DELETE' },
        { name: 'ListingInvalidated', operationType: 'INVALIDATE'},
    ]

    let allEvents: Array<{
        args: EventDetails;
        blockNumber: number;
        operationType: string;
    }> = [];

    for (const eventType of eventTypes) {
        const events = blockNumber === 0
            ? await contract.queryFilter(eventType.name)
            : await contract.queryFilter(eventType.name, blockNumber);

        const typedEvents = events.filter(isEventLog).map(event => {
            const { id, cityId, offChainLink, dataHash, timestamp } = event.args as unknown as EventDetails;
            return {
                args: { id, cityId, offChainLink, dataHash, timestamp, blockNumber: event.blockNumber },
                blockNumber: event.blockNumber,
                operationType: eventType.operationType
            };
        });

        allEvents.push(...typedEvents);
    }

    allEvents.sort((a, b) => a.blockNumber - b.blockNumber);
    for (const event of allEvents) {
        console.debug(`Processing ${event.operationType} event for listing id: ${event.args.id} in block number: ${event.blockNumber}`);

        if (getListingUpdatedAt && await shouldIgnore(event.args.id, event.args.offChainLink, getListingUpdatedAt)) {
            console.debug(`Listing id: ${event.args.id} is not newer. Skipping update.`);
            continue;
        }

        const listing = await getListingFromURL({
            id: event.args.id,
            cityId: event.args.cityId,
            offChainLink: event.args.offChainLink,
            dataHash: event.args.dataHash,
            timestamp: event.args.timestamp,
            blockNumber: event.blockNumber
        }, errorHandling, strictHash);

        if (listing) {
            await withRetries(async () => {
                const eventObj = {
                    id: event.args.id,
                    cityId: event.args.cityId,
                    offChainLink: event.args.offChainLink,
                    dataHash: event.args.dataHash,
                    timestamp: event.args.timestamp,
                    blockNumber: event.blockNumber,
                    operationType: event.operationType,
                };

                await listingHandler(listing, eventObj);
                await writeBlockNumberToFile(event.blockNumber);

                if (broadcaster && blockNumber !== 0 && event.operationType !== 'DELETE') {
                    broadcaster.broadcast(listing, eventObj);
                }
            }, {
                blockNumber: event.blockNumber,
                offChainLink: event.args.offChainLink,
            }, errorHandling);
        }
    }
}

export function registerV3Listener(
    contract: Contract,
    getListingFromURL: FetchListingFromURL,
    listingHandler: ListingHandler,
    withRetries: WithRetries,
    writeBlockNumberToFile: WriteBlockNumberToFile,
    handleErr: HandleError,
    strictHash: boolean,
    errorHandling: any,
    broadcaster: Broadcaster | null,
    getListingUpdatedAt: GetListingUpdatedAt | null
): void {
    let eventProcessing = Promise.resolve();

    // Remove existing listeners before adding new ones
    contract.removeAllListeners('NewListing');
    contract.removeAllListeners('ListingUpdated');
    contract.removeAllListeners('ListingDeleted');
    contract.removeAllListeners('ListingInvalidated');

    const newListingListener = (id: string, cityId: string, offChainLink: string, dataHash: string, timestamp: number, payload: any) => {
        eventProcessing = eventProcessing.then(async () => {
            console.debug(`received listing id: ${id} in block number: ${payload.log.blockNumber}`);

            if (getListingUpdatedAt && await shouldIgnore(id, offChainLink, getListingUpdatedAt)) {
                console.debug(`Listing id: ${id} is not newer. Skipping update.`);
                return;
            }

            const listing = await getListingFromURL({
                id,
                cityId,
                offChainLink,
                dataHash,
                timestamp,
                blockNumber: payload.log.blockNumber
            }, errorHandling, strictHash);

            if (listing) {
                await withRetries(async () => {
                    const eventObj = {
                        id,
                        cityId,
                        offChainLink,
                        dataHash,
                        timestamp,
                        blockNumber: payload.log.blockNumber,
                        operationType: 'ADD'
                    };

                    await listingHandler(listing, eventObj);
                    await writeBlockNumberToFile(payload.log.blockNumber);
                    if (broadcaster) {
                        broadcaster.broadcast(listing, eventObj);
                    }
                }, {
                    blockNumber: payload.log.blockNumber,
                    offChainLink
                }, errorHandling);
            }
        }).catch(error => {
            handleErr(error, { blockNumber: payload.log.blockNumber, offChainLink: payload.log.offChainLink }, errorHandling);
        });
    }


    const listingUpdatedListener = (id: string, cityId: string, offChainLink: string, dataHash: string, timestamp: number, payload: any) => {
        eventProcessing = eventProcessing.then(async () => {
            console.debug(`received update for listing id: ${id} in block number: ${payload.log.blockNumber}`);

            if (getListingUpdatedAt && await shouldIgnore(id, offChainLink, getListingUpdatedAt)) {
                console.debug(`Listing id: ${id} is not newer. Skipping update.`);
                return;
            }

            const listing = await getListingFromURL({
                id,
                cityId,
                offChainLink,
                dataHash,
                timestamp,
                blockNumber: payload.log.blockNumber
            }, errorHandling, strictHash);

            if (listing) {
                await withRetries(async () => {
                    const eventObj = {
                        id,
                        cityId,
                        offChainLink,
                        dataHash,
                        timestamp,
                        blockNumber: payload.log.blockNumber,
                        operationType: 'UPDATE'
                    };

                    await listingHandler(listing, eventObj);
                    await writeBlockNumberToFile(payload.log.blockNumber);
                    if (broadcaster) {
                        broadcaster.broadcast(listing, eventObj);
                    }
                }, {
                    blockNumber: payload.log.blockNumber,
                    offChainLink
                }, errorHandling);
            }
        }).catch(error => {
            handleErr(error, { blockNumber: payload.log.blockNumber, offChainLink: payload.log.offChainLink }, errorHandling);
        });
    };

    const listingDeletedListener = (id: string, cityId: string, offChainLink: string, dataHash: string, timestamp: number, payload: any) => {
        eventProcessing = eventProcessing.then(async () => {
            console.debug(`received deletion for listing id: ${id} in block number: ${payload.log.blockNumber}`);

            if (getListingUpdatedAt && await shouldIgnore(id, offChainLink, getListingUpdatedAt)) {
                console.debug(`Listing id: ${id} is not newer. Skipping update.`);
                return;
            }

            const listing = await getListingFromURL({
                id,
                cityId,
                offChainLink,
                dataHash,
                timestamp,
                blockNumber: payload.log.blockNumber
            }, errorHandling, strictHash);

            if (listing) {
                await withRetries(async () => {
                    await listingHandler(listing, {
                        id,
                        cityId,
                        offChainLink,
                        dataHash,
                        timestamp,
                        blockNumber: payload.log.blockNumber,
                        operationType: 'DELETE'
                    });

                    await writeBlockNumberToFile(payload.log.blockNumber);
                }, {
                    blockNumber: payload.log.blockNumber,
                    offChainLink
                }, errorHandling);
            }
        }).catch(error => {
            handleErr(error, { blockNumber: payload.log.blockNumber, offChainLink: payload.log.offChainLink }, errorHandling);
        });
    };

    const listingInvalidatedListener = (id: string, cityId: string, offChainLink: string, dataHash: string, timestamp: number, payload: any) => {
        eventProcessing = eventProcessing.then(async () => {
            console.debug(`received invalidation for listing id: ${id} in block number: ${payload.log.blockNumber}`);

            if (getListingUpdatedAt && await shouldIgnore(id, offChainLink, getListingUpdatedAt)) {
                console.debug(`Listing id: ${id} is not newer. Skipping update.`);
                return;
            }

            const listing = await getListingFromURL({
                id,
                cityId,
                offChainLink,
                dataHash,
                timestamp,
                blockNumber: payload.log.blockNumber
            }, errorHandling, strictHash);

            if (listing) {
                await withRetries(async () => {
                    await listingHandler(listing, {
                        id,
                        cityId,
                        offChainLink,
                        dataHash,
                        timestamp,
                        blockNumber: payload.log.blockNumber,
                        operationType: 'INVALIDATE'
                    });

                    await writeBlockNumberToFile(payload.log.blockNumber);
                }, {
                    blockNumber: payload.log.blockNumber,
                    offChainLink
                }, errorHandling);
            }
        }).catch(error => {
            handleErr(error, { blockNumber: payload.log.blockNumber, offChainLink: payload.log.offChainLink }, errorHandling);
        });
    };

    contract.on('NewListing', newListingListener);
    contract.on('ListingUpdated', listingUpdatedListener);
    contract.on('ListingDeleted', listingDeletedListener);
    contract.on('ListingInvalidated', listingInvalidatedListener);
}
