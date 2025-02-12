import { Listing } from "../../types";
import { InstagramChannelOption } from "./interface";

const INSTAGRAM_API_BASE_URL = "https://graph.instagram.com/v22.0";

export function handleInstagram(channelOption: InstagramChannelOption) {
    const driverOptions = channelOption.driverOptions;

    return async (job: any) => {
        try {
            const { listing, caption }: {listing: Listing; caption: string} = job.attrs.data;
            const postText = caption || listing.description;
            console.log(`Start posting instagram to account ${driverOptions.instagramAccountId} for ${listing.listingIdStr}`);

            // Reference: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
            const mediaContainerUrl = `${INSTAGRAM_API_BASE_URL}/${driverOptions.instagramAccountId}/media`;

            if (listing.pictureUrls.length > 0) {
                let containerIds = [] as string[];
                const isCarouselItem = listing.pictureUrls.length > 1;

                // Create Media Containers
                for (const url of listing.pictureUrls) {
                    let bodyParams = {
                        image_url: url,
                        is_carousel_item: isCarouselItem,
                        caption: ''
                    };

                    if (!isCarouselItem) {
                        bodyParams.caption = postText;
                    }

                    try {
                        const mediaContainerResponse = await fetch(`${mediaContainerUrl}?access_token=${driverOptions.accessToken}`,
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(bodyParams)
                            }
                        );

                        const responseData = await mediaContainerResponse.json();

                        if (!mediaContainerResponse.ok) {
                            throw new Error(JSON.stringify(responseData.error));
                        }

                        containerIds.push(responseData.id);
                    } catch (error) {
                        console.error("Failed to upload media", error);
                    }
                }

                let creationId = containerIds[0];

                if (isCarouselItem && containerIds.length > 1) {
                    //Create Carousel Container
                    let bodyParams = {
                        media_type: 'CAROUSEL',
                        children: containerIds.join(','),
                        caption: postText
                    };

                    const carouselContainerResponse = await fetch(`${mediaContainerUrl}?access_token=${driverOptions.accessToken}`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(bodyParams)
                        });

                    const carouselContainerResponseData = await carouselContainerResponse.json();

                    if (!carouselContainerResponse.ok) {
                        throw new Error(`Failed to create carousel container :: ${JSON.stringify(carouselContainerResponseData.error)}`);
                    }

                    creationId = carouselContainerResponseData.id;
                }

                // Publish Carousel Container
                const publishUrl = `${INSTAGRAM_API_BASE_URL}/${driverOptions.instagramAccountId}/media_publish`;

                const publishResponse = await fetch(`${publishUrl}?access_token=${driverOptions.accessToken}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            creation_id: creationId,
                        })
                    });

                const publishResponseData = await publishResponse.json();

                if (!publishResponse.ok) {
                    throw new Error(`Failed to publish media :: ${JSON.stringify(publishResponseData.error)}`);
                }

            } else {
                // If no images, post only the caption (Instagram does not support text-only posts via API)
                console.warn("Instagram API does not support text-only posts. Please include at least one image.");
            }
            console.log('Finish posting instagram for ' + listing.listingIdStr);
        } catch (error) {
            console.error("Failed to post to Instagram. ", error);
            throw error;
        }
    };
}
