# Broadcast

Library to broadcast added or updated Listing to multiple channels

## Installation

To use, simply add below lines to your code:
```
import { broadcast } from 'broadcast';
```

## Usage

To use Broadcast, following options will need to be specified:
- brokerOptions
-- define channel credentials and whether or not broadcast should post to this channel. Structure can be found at ./channel/interface.ts
- mongoURI
-- define mongoURI to store broadcast status and agenda queue.
- mongoDatabase
-- define mongoDatabase to store broadcast status and agenda queue.

## Adding New Channel

Adding new Channel using following steps:
1. Add new options to ./channel/interface.ts. This options are used for authenticating to Channel API or other usage when handling the post (For example: post delay, allowed post per day, etc.). See `SampleOptions`
2. Create new Typescript file in ./channel directory using channel name (in the instance when channel name contains more than 1 words, use camelCase).
3. Create an exported channel name and function. (See `./channel/sample.ts` for channel name and function format)
- Channel name constant should be all upper-cased with this format: `<CHANNEL_NAME>_CHANNEL_NAME`
- Function should accept Option as parameter and return an async function with job as parameter.

## Example
Integrating broadcast can be seen at `example.js`. 

Replace the value with actual value to test posting mechanism.

Steps to run:
1. Then, run `npm run build`

2. To run example, simply run this command: `node example.js`