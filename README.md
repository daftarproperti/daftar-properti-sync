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
- provider [required]
-- provider to consume blockchain data.
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
-- errorHandler: define this to customly handle incoming error

See `example.ts` for sample code