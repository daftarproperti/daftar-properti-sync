import { Contract, EventLog, Log } from 'ethers';
import { FetchListingFromURL, ListingHandler, WithRetries, WriteBlockNumberToFile, HandleError } from '../interfaces';
import { EventDetails } from '../types';
import { Broadcaster } from '../broadcast/broadcaster';

function isEventLog(event: EventLog | Log): event is EventLog {
    return 'args' in event;
}

export async function fetchPastListingsV1(
    blockNumber: number,
    contract: Contract,
    getListingFromURL: FetchListingFromURL,
    listingHandler: ListingHandler,
    withRetries: WithRetries,
    writeBlockNumberToFile: WriteBlockNumberToFile,
    strictHash: boolean,
    errorHandling: any,
    broadcaster: Broadcaster | null
): Promise<void> {
    const newListingEvents = blockNumber === 0
        ? await contract.queryFilter('NewListing')
        : await contract.queryFilter('NewListing', blockNumber);

    const newListingTypedEvents = newListingEvents.filter(isEventLog).map(event => {
        const { id, cityId, offChainLink, dataHash, timestamp } = event.args as unknown as EventDetails;
        return {
            args: { id, cityId, offChainLink, dataHash, timestamp },
            blockNumber: event.blockNumber,
        };
    });

    await Promise.all(newListingTypedEvents.map(async (event) => {
        console.debug(`received listing id: ${event.args.id} in block number: ${event.blockNumber}`);

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
                    operationType: 'ADD',
                };

                await listingHandler(listing, eventObj);
                await writeBlockNumberToFile(event.blockNumber);
                // Only broadcast missed listing. Past listing should not be rebroadcasted
                if (broadcaster && blockNumber !== 0) {
                    broadcaster.broadcast(listing, eventObj);
                }
            }, {
                blockNumber: event.blockNumber,
                offChainLink: event.args.offChainLink,
            }, errorHandling);
        }
    }));

    const updateListingEvents = blockNumber === 0
        ? await contract.queryFilter('ListingUpdated')
        : await contract.queryFilter('ListingUpdated', blockNumber);

    const updateListingTypedEvents = updateListingEvents.filter(isEventLog).map(event => {
        const { id, cityId, offChainLink, dataHash, timestamp } = event.args as unknown as EventDetails;
        return {
            args: { id, cityId, offChainLink, dataHash, timestamp },
            blockNumber: event.blockNumber,
        };
    });

    await Promise.all(updateListingTypedEvents.map(async (event) => {
        console.debug(`received update for listing id: ${event.args.id} in block number: ${event.blockNumber}`);

        const listing = await getListingFromURL({
                id: event.args.id,
                cityId: event.args.cityId,
                offChainLink: event.args.offChainLink,
                dataHash: event.args.dataHash,
                timestamp: event.args.timestamp,
                blockNumber: event.blockNumber,
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
                    operationType: 'UPDATE'
                };

                await listingHandler(listing, eventObj);
                await writeBlockNumberToFile(event.blockNumber);
                // Only broadcast missed listing. Past listing should not be rebroadcasted
                if (broadcaster && blockNumber !== 0) {
                    broadcaster.broadcast(listing, eventObj);
                }
            }, {
                blockNumber: event.blockNumber,
                offChainLink: event.args.offChainLink,
            }, errorHandling);
        }
    }));

    const deleteListingEvents = blockNumber === 0
        ? await contract.queryFilter('ListingDeleted')
        : await contract.queryFilter('ListingDeleted', blockNumber);

    const deleteListingTypedEvents = deleteListingEvents.filter(isEventLog).map(event => {
        const { id, cityId, offChainLink, dataHash, timestamp } = event.args as unknown as EventDetails;
        return {
            args: { id, cityId, offChainLink, dataHash, timestamp },
            blockNumber: event.blockNumber,
        };
    });

    await Promise.all(deleteListingTypedEvents.map(async (event) => {
        console.debug(`received deletion for listing id: ${event.args.id} in block number: ${event.blockNumber}`);

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
                await listingHandler(listing, {
                    id: event.args.id,
                    cityId: event.args.cityId,
                    offChainLink: event.args.offChainLink,
                    dataHash: event.args.dataHash,
                    timestamp: event.args.timestamp,
                    blockNumber: event.blockNumber,
                    operationType: 'DELETE',
                });

                await writeBlockNumberToFile(event.blockNumber);
            }, {
                blockNumber: event.blockNumber,
                offChainLink: event.args.offChainLink,
            }, errorHandling);
        }
    }));
}

export function registerV1Listener(
    contract: Contract,
    getListingFromURL: FetchListingFromURL,
    listingHandler: ListingHandler,
    withRetries: WithRetries,
    writeBlockNumberToFile: WriteBlockNumberToFile,
    handleErr: HandleError,
    strictHash: boolean,
    errorHandling: any,
    broadcaster: Broadcaster | null
): void {
    let eventProcessing = Promise.resolve();

    // Remove existing listeners before adding new ones
    contract.removeAllListeners('NewListing');
    contract.removeAllListeners('ListingUpdated');
    contract.removeAllListeners('ListingDeleted');

    const newListingListener = (id: string, cityId: string, offChainLink: string, dataHash: string, timestamp: number, payload: any) => {
        eventProcessing = eventProcessing.then(async () => {
            console.debug(`received listing id: ${id} in block number: ${payload.log.blockNumber}`);

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

    contract.on('NewListing', newListingListener);
    contract.on('ListingUpdated', listingUpdatedListener);
    contract.on('ListingDeleted', listingDeletedListener);
}
