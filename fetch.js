const crypto = require('crypto');
const { handleErr } = require("./errorHandler");

async function getListingFromURL(event, errorHandling, strictHash) {
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
        // JSON.parse cannot handle int64 without losing precision, so here we
        // force .listingId to be a BigInt from .listingIdStr.
        rawListing.listingId = BigInt(rawListing.listingIdStr)
        return rawListing;
    }, { 
        blockNumber: event.blockNumber,
        offChainLink: event.offChainLink,
    }, errorHandling);
}

async function withRetries(fn, context = {}, errorHandling, retries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 3;
        } else {
            await handleErr(error, {blockNumber: context.blockNumber, offChainLink: context.offChainLink}, errorHandling);
        }
      }
    }
}

module.exports = { getListingFromURL, withRetries };
