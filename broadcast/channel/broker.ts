import * as fs from 'fs';
import * as path from "path";
import { Agenda } from "@hokify/agenda";
import { DOWNLOAD_IMAGES_DIRECTORY } from "./downloadImage";
import { AVAILABLE_CHANNELS, BrokerOptions, ChannelOption, STATUS, Transform } from "./interface";
import { handleTwitter } from "./twitter";
import { handleInstagram } from "./instagram";
import { Listing } from '../../types';

export class Broker {
    agenda: Agenda;
    broadcastCollection: any;
    brokerOptions: BrokerOptions;
    activeJobs: Map<string, number>;

    constructor(agenda: Agenda, broadcastCollection: any, brokerOptions: BrokerOptions) {
        this.agenda = agenda;
        this.broadcastCollection = broadcastCollection;
        this.brokerOptions = brokerOptions;
        this.activeJobs = new Map();

        this.agenda.on('success', this.onJobCompletion.bind(this));
        this.agenda.on('fail', this.onJobCompletion.bind(this));

        // Initialize Agenda Tasks
        for (const channelOption of this.brokerOptions.channelOptions) {
            const getMethodHandler = (channelOption: ChannelOption) => {
                switch (channelOption.driverName) {
                    case AVAILABLE_CHANNELS.TWITTER:
                        return handleTwitter(channelOption);
                    case AVAILABLE_CHANNELS.INSTAGRAM:
                        return handleInstagram(channelOption);
                }
            };

            // Register task
            this.registerChannelTask(
              `${channelOption.driverName}-${channelOption.name}`,
              channelOption.transform,
              getMethodHandler(channelOption),
            );
        }
    }

    private registerChannelTask(channelName: string, transform: Transform, mediaTask: (job: any) => Promise<void>) {
        this.agenda.define(`post-to-${channelName.toLowerCase()}`, async (job: any) => {
            console.log(`Posting to ${channelName} . . .`);

            const { event, listing } = job.attrs.data;
            const initialBackoff = 1000;

            let broadcastId = job.attrs.data.broadcastId;
            if (!broadcastId) {
                const broadcastEntry = {
                    dp_id: listing.listingIdStr,
                    block_number: event.blockNumber,
                    channel: channelName,
                    listing: listing,
                    event: event,
                    request: {
                        image_urls: listing.imageURLs || [],
                        caption: listing.description
                    },
                    status: STATUS.PENDING,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
                
                const insertResult = await this.broadcastCollection.insertOne(broadcastEntry);
                broadcastId = insertResult.insertedId;
                job.attrs.data.broadcastId = broadcastId;
                await job.save();
            }

            if (typeof transform === 'function') {
                const caption = await transform(listing);
                job.attrs.data.caption = caption;
                await job.save();
            }

            try {
                await mediaTask(job);

                await this.broadcastCollection.updateOne(
                    { _id: broadcastId },
                    { $set: { status: STATUS.SUCCESS, updatedAt: new Date() } },
                    { upsert: true }
                );
            } catch (error) {
                const retries = job.attrs.failCount || 0;
                console.error(`Error posting to ${channelName}: ${error}`);
                if (retries < this.brokerOptions.maxRetries) {
                    const nextBackoff = initialBackoff * Math.pow(2, retries);
                    const nextRetryDate = new Date(Date.now() + nextBackoff);
                    console.warn(`Retrying post to ${channelName}. Attempt ${retries + 1} of ${this.brokerOptions.maxRetries}. Next retry at: ${nextRetryDate}`);

                    job.fail(error);
                    job.attrs.nextRunAt = nextRetryDate;
                    await job.save();
                } else {
                    console.error(`Failed posting to ${channelName} after ${retries} retries. Marking as FAILED.`);
                    job.fail(`Max retries reached: ${this.brokerOptions.maxRetries}`);
                    await job.save();
                    await this.broadcastCollection.updateOne(
                        { _id: broadcastId },
                        { $set: { status: STATUS.FAILED, updatedAt: new Date() } },
                        { upsert: true }
                    );
                }
            }
        });
    }

    async broadcast(event: any, listing: Listing): Promise<void> {
        const broadcastPromises = [];
        let jobCount = 0;
    
        for (const channelOption of this.brokerOptions.channelOptions) {
            // Check channel enabled earliest before everything else
            if (!channelOption.enabled) {
                continue;
            }

            // Filter listing to post
            if (!channelOption.filter(listing, event)) {
                continue;
            }

            const channelName = `${channelOption.driverName}-${channelOption.name}`;
            const taskName = `post-to-${channelName.toLowerCase()}`;
        
            console.log(`Queuing broadcast for channel: ${channelName}`);
            broadcastPromises.push(
                this.agenda.now(taskName, { event: event, listing: listing })
            );
            jobCount++;
        }

        if (jobCount > 0) {
            this.activeJobs.set(listing.listingIdStr, jobCount);
        }

        try {
            await Promise.all(broadcastPromises);
        } catch (error) {
            console.error("Error broadcasting to one or more channels:", error);
        }
    }

    async retryBroadcast(failedBroadcast: any): Promise<void> {
        const { channel, event, listing, _id: broadcastId } = failedBroadcast;
        const channelTask = `post-to-${channel.toLowerCase()}`;

        console.log(`Retrying for channel: ${channel}, broadcastId: ${broadcastId}`);
        try {
            await this.broadcastCollection.updateOne(
                { _id: broadcastId },
                { $set: { status: STATUS.PENDING, updatedAt: new Date() } },
                { upsert: true }
            );

            await this.agenda.now(channelTask, {
                event,
                listing,
                broadcastId,
            });
        } catch (error) {
            console.error(`Failed to retry broadcast for channel: ${channel}, broadcastId: ${broadcastId}. error: `, error);
            throw error;
        }
        return;
    }

    private async onJobCompletion(job: any) {
        if (!job.attrs || !job.attrs.data || !job.attrs.data.listing) {
            console.warn("Job attributes or data are undefined, skipping job completion handling.");
            return;
        }
        
        const { listingIdStr } = job.attrs.data.listing;
        const remainingJobs = (this.activeJobs.get(listingIdStr) || 1) - 1;

        if (remainingJobs <= 0) {
            this.activeJobs.delete(listingIdStr);
            await this.cleanupImages(listingIdStr);
        } else {
            this.activeJobs.set(listingIdStr, remainingJobs);
        }
    }

    private async cleanupImages(listingIdStr: string): Promise<void> {
        const listingImageDir = `${DOWNLOAD_IMAGES_DIRECTORY}/${listingIdStr}`;
        try {
            if (fs.existsSync(listingImageDir)) {
                const imagePaths = fs
                    .readdirSync(listingImageDir)
                    .filter((file: string) => /\.(jpg|jpeg|png|gif)$/i.test(file))
                    .map((file: string) => path.join(listingImageDir, file));
    
                for (const imagePath of imagePaths) {
                    fs.unlinkSync(imagePath);
                }
                fs.rmdirSync(listingImageDir, { recursive: true });
            } else {
                console.warn(`Directory does not exist for listing: ${listingIdStr}. Skipping . . .`);
            }
        } catch (cleanupError) {
            console.warn(`Failed to clean up images for listing: ${listingIdStr}`, cleanupError);
        }
    }
}
