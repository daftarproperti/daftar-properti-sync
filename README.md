# DP Sync

Library to ease the use for Daftar Properti's data

## Installation

To use, simply add below lines to your code:
```
const { createInstance } = require('daftar-properti-sync');
```

## Usage

To view all logs:
- Go to localhost:{PORT}

To view Health Checks and last processed block:
- Go to localhost:{PORT}/health

To use DP Sync Library you will need to define following options:
- port
-- define a port to run simple web interface
- address
-- contract address for the blockchain
- strictHash
-- true to stop processing if unmatched hash data exist.
- providerHost [required]
-- pass provider url to consume blockchain data.
- abiVersion [required]
-- specify which contract abi version will be used
- fetchAll
-- If set to true, Synchronizer will fetch from the beginning of the data
- fromBlockNumber
-- If set to other than 0, Synchronizer will fetch from the specified block number onwards
- fetchLastKnownBlockNumber
-- Since the synchronizer may not run continously, add this function to ensure data is synchronized from the last time a listing is upserted to your database. Should return a block number. Omit this to use Library's own handler
- listingHandler [required]
-- Add this function to implement your custom logic of what to do with the listing data provided.
- errorHandling
-- errorChannel: define which channel to use when sending error notifications (Available options: SLACK)
-- slackConfiguration: if SLACK is chosen as error channel, please provide required configuration.
--- slackWebhookURL: [required] Slack webhook url to send message to
- errorHandler: define this to customly handle incoming error
- broadcaster: define broadcasting configuration to broadcast listing into social media. See `/broadcast/README.md` for more details.
- broadcastOptions: define broadcasting configuration to broadcast listing into social media. See `/broadcast/README.md` for more details.

## Real Time Syncing

Daftar Properti Sync supports real time syncing by default. To use real time syncing, after installing daftar properti sync library and defining options, add following code:
```
const instance = createInstance(options);

await instance.start();
```

## Periodic Syncing

Daftar Properti Sync also supports periodic syncing to save compute resources (E.g: Synchronizer does not need to run continously, but instead periodically in a containerized environment). To use periodic syncing, several options need to be defined.

```
async function fetchLatestBlockNumber(): Promise<number> {
    // Wherever persisting listing, it has block number by default
    // If using custom listingHandler, make sure to save the block number as well
    const blockNumber = getBlockNumberInListingData();

    return blockNumber;
}
 
// add this option
options.fetchLastKnownBlockNumber = fetchLatestBlockNumber;

// Same as real time syncing, define instance first
const instance = createInstance(options);

// Suppose periodic logic is handled in the container
// Each interval only call this function
await instance.fetchMissedListings();
```

See `example.ts` for sample code