import * as fs from 'fs';
import axios from 'axios';
import { extname, basename } from 'path';

export const DOWNLOAD_IMAGES_DIRECTORY = './downloadedImages';

export async function downloadImages(listingId: string, imageURLs: string[]): Promise<void> {
    if (!fs.existsSync(DOWNLOAD_IMAGES_DIRECTORY)) {
        fs.mkdirSync(DOWNLOAD_IMAGES_DIRECTORY, { recursive: true });
    }

    const listingDirectory = `${DOWNLOAD_IMAGES_DIRECTORY}/${listingId}`;
    if (!fs.existsSync(listingDirectory)) {
        fs.mkdirSync(listingDirectory, { recursive: true });
    }

    const downloadImage = async (url: string, index: number) => {
        try {
            const extension = extname(url) || '.jpg';
            const baseName = basename(url, extension);
            const imagePath = `${listingDirectory}/${baseName}${extension}`;

            // If image exist in path, do not download it again
            if (fs.existsSync(imagePath)) {
                return;
            }

            const res = await axios.get(url, { responseType: 'arraybuffer' });
            fs.writeFileSync(imagePath, res.data);
        } catch (error) {
            console.error(`Failed to download image at ${url}. error: `, error);
        }
    };

    const downloadPromises = imageURLs.map((url, index) => downloadImage(url, index));
    await Promise.all(downloadPromises);
}