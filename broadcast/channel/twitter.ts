import * as fs from "fs";
import * as path from "path";
import { DOWNLOAD_IMAGES_DIRECTORY, downloadImages } from "./downloadImage";
import { TwitterChannelOption } from "./interface";

import { TwitterApi } from "twitter-api-v2";

export function handleTwitter(channelOption: TwitterChannelOption) {
    const driverOptions = channelOption.driverOptions;

    const client = new TwitterApi({
        appKey: driverOptions.appKey,
        appSecret: driverOptions.appSecret,
        accessToken: driverOptions.accessToken,
        accessSecret: driverOptions.accessSecret
    });

    const twitterClient = client.readWrite;
    
    return async (job: any) => {
        try {
            const { listing, caption } = job.attrs.data;

            const tweetText = caption || listing.description;

            await downloadImages(listing.listingIdStr, listing.pictureUrls);

            const listingImageDir = `${DOWNLOAD_IMAGES_DIRECTORY}/${listing.listingIdStr}`;
            const imagePaths = fs
                .readdirSync(listingImageDir)
                .filter((file: string) => /\.(jpg|jpeg|png|gif)$/i.test(file))
                .map((file: string) => path.join(listingImageDir, file));

            const mediaIds = [];
            // Twitter allows a maximum of 4 media items per tweet
            const maxMediaUploadLimit = 4;
            const limitedImagePaths = imagePaths.slice(0, maxMediaUploadLimit);

            for (const imagePath of limitedImagePaths) {
                try {
                    const mediaId = await twitterClient.v1.uploadMedia(imagePath);
                    mediaIds.push(mediaId);
                } catch (error) {
                    console.error(`Failed to upload image ${imagePath} to twitter. error: `, error);
                }
            }

            if (mediaIds.length > 0) {
                await twitterClient.v2.tweet({
                    text: tweetText,
                    media: { media_ids: mediaIds as [string] | [string, string] | [string, string, string] | [string, string, string, string] }
                });
            } else {
                await twitterClient.v2.tweet({ text: tweetText });
            }
        } catch (error) {
            console.error("Failed to post to twitter. error: ", error);
            throw error;
        }
    }
}
