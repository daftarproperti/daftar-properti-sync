import crypto from 'crypto';
import fetch from 'node-fetch';
import { handleErr } from './errorHandler';
import { EventDetails, EventContext } from './types';

export async function getListingFromURL(
    event: EventDetails,
    errorHandling: any,
    strictHash: boolean
): Promise<any> {
    return withRetries(async () => {
        const response = await fetch(event.offChainLink);
        const respArrBuf = await response.arrayBuffer();
        const bufferListing = Buffer.from(respArrBuf);
        const hash = crypto.createHash('sha256').update(bufferListing).digest('hex');

        if (hash !== event.dataHash) {
            console.warn(`Hash mismatch for listing ID ${event.id} with block number: ${event.blockNumber}`);
            if (strictHash) {
                return null;
            }
        }

        const rawListing = JSON.parse(bufferListing.toString());
        rawListing.listingId = BigInt(rawListing.listingIdStr);
        return rawListing;
    }, { blockNumber: event.blockNumber, offChainLink: event.offChainLink }, errorHandling);
}

export async function withRetries(
    fn: () => Promise<void>,
    context: EventContext,
    errorHandling: any,
    retries: number = 3,
    delay: number = 1000
): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
        return await fn();
        } catch (error) {
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 3;
            } else {
                await handleErr(error as Error, { blockNumber: context.blockNumber, offChainLink: context.offChainLink }, errorHandling);
            }
        }
    }
}
