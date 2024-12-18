import { SampleDriverOptions } from "./interface";

export const SAMPLE_CHANNEL_NAME = "SAMPLE";

export function handleSample(sampleOptions: SampleDriverOptions) {
    return async (job: any) => {
        try {
            const { caption, event, listing } = job.attrs.data;

            console.log(sampleOptions.apiKey);
        } catch (error) {
            console.error("Failed to post to twitter. error: ", error);
            throw error;
        }
    }
}