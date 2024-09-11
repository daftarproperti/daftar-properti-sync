module.exports.fetchPastListingsV1 = async function(blockNumber, contract, getListingFromURL, listingHandler, withRetries, writeBlockNumberToFile, handleErr, strictHash, errorHandling) {
    const newListingEvents = blockNumber === 0
            ? await contract.queryFilter("NewListing")
            : await contract.queryFilter("NewListing", blockNumber);

    await Promise.all(newListingEvents.map(async event => {
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
            withRetries(async () => {
                await listingHandler(listing, {
                    id: event.args.id,
                    cityId: event.args.cityId,
                    offChainLink: event.args.offChainLink,
                    dataHash: event.args.dataHash,
                    timestamp: event.args.timestamp,
                    blockNumber: event.blockNumber,
                    operationType: "ADD",
                });

                await writeBlockNumberToFile(event.blockNumber);
            }, {
                blockNumber: event.blockNumber,
                offChainLink: event.args.offChainLink,
            }, errorHandling);
        }
    }));
};

module.exports.registerV1Listener = function(contract, getListingFromURL, listingHandler, withRetries, writeBlockNumberToFile, handleErr, strictHash, errorHandling) {
    let eventProcessing = Promise.resolve();

    contract.on("NewListing", (id, cityId, offChainLink, dataHash, timestamp, payload) => {
        eventProcessing = eventProcessing.then(async () => {
            console.debug(`received listing id: ${id} in block number: ${payload.log.blockNumber}`);

            const listing = await getListingFromURL({ id, cityId, offChainLink, dataHash, timestamp, blockNumber: payload.log.blockNumber }, errorHandling, strictHash);
            if (listing) {
                withRetries(async () => {
                    await listingHandler(listing, {
                        id,
                        cityId,
                        offChainLink,
                        dataHash,
                        timestamp,
                        blockNumber: payload.log.blockNumber,
                        operationType: "ADD"
                    });

                    await writeBlockNumberToFile(payload.log.blockNumber);
                }, {
                    blockNumber: payload.log.blockNumber,
                    offChainLink: offChainLink,
                }, errorHandling);
            }
        }).catch(error => {
            handleErr(error, { blockNumber: payload.log.blockNumber, offChainLink: payload.log.offChainLink }, errorHandling);
        });
    });
};