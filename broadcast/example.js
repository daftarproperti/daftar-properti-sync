import { Broadcaster } from '../js-generated/broadcast/broadcaster.js';
import { AVAILABLE_CHANNELS } from '../js-generated/broadcast/channel/interface.js';

const testListing = {
    listingId: 1.7798019020882337e18,
    listingIdStr: "1779801902088233629",
    propertyType: "land",
    listingForSale: true,
    listingForRent: false,
    address: "Jalan Blok Gading, Dusun III Kecamatan : Sunggal kelurahan : Tanjung Gusta Sumatera Utara",
    description: "Dijual Tanah Sunggal Deli Serdang\r\n\r\nLuas Tanah : 20 x 24 = 480 m2\r\n\r\nJumlah Kamar Tidur : 2\r\n\r\nJumlah Kamar Mandi : 1\r\n\r\nJumlah Lantai : 1\r\n\r\nJumlah Garasi/carport : -\r\n\r\nJenis Sertifikat : Akte Notaris\r\n\r\nHarga : Rp. 384.000.000",
    price: 384000000,
    rentPrice: null,
    lotSize: 480,
    buildingSize: 0,
    carCount: 0,
    bedroomCount: 2,
    bathroomCount: 1,
    floorCount: 1,
    electricPower: null,
    facing: "unknown",
    ownership: "unknown",
    isVerified: true,
    cityName: "Kab. Deli Serdang",
    cityId: 8483353,
    pictureUrls: [
        "https://storage.googleapis.com/daftarproperti-production-image-bucket/1734334880_85da02c16fb286ccaa9f9a5d10104278.jpg",
        "https://storage.googleapis.com/daftarproperti-production-image-bucket/1734334881_575fedc21cde1fcadcce560a7e0aac74.jpg"
    ],
    coordinate: {
        latitude: 3.6189111,
        longitude: 98.59131
    },
    withRewardAgreement: true,
    isMultipleUnits: false,
    createdAt: "2024-12-16T14:41:21+07:00",
    updatedAt: "2024-12-18T12:19:14+07:00",
    registrant: {
        name: "Test Broadcaster",
        phoneNumberEncrypted: "abcd",
        phoneNumberHash: "abcd",
        delegatePhoneHash: null,
        profilePictureURL: null,
        company: null
    }
};

const testEvent = {
    id: "test-event-id",
    cityId: "8483353",
    offChainLink: "https://example.com/event/test-event-id",
    dataHash: "e2c7d334e5a62fcf4b2a3fdf61d4321b",
    timestamp: 1702905600,
    blockNumber: 1234567,
    operationType: "ADD"
};

const testOptions = {
    // Replace this with desired mongoURI
    mongoURI: 'mongodb://localhost:27017',
    // Replace this with desired mongoDatabase
    mongoDatabase: 'test',
    brokerOptions: {
        maxRetries: 2,
        twitterOptions: {
            enabled: true
        },
        channelOptions: [
            {
                name: 'Test Twitter',
                filter: async (listing) => {
                    console.log("FILTERING LISTING . . .");
                    return true;
                },
                transform: async (listing) => {
                    console.log("TRANSFORMING LISTING DESCRIPTION . . .");
                    return listing.description;
                },
                driverName: AVAILABLE_CHANNELS.TWITTER,
                driverOptions: {
                    appKey: "YOUR_APP_KEY",
                    appSecret: "YOUR_APP_SECRET",
                    accessToken: "YOUR_ACCESS_TOKEN",
                    accessSecret: "YOUR_ACCESS_SECRET"
                }
            }
        ]
    }
};

const broadcaster = new Broadcaster(testOptions);

async function main() {
    try {
        await broadcaster.start();
        console.log('Broadcast service started.');

        console.log('Testing broadcast method . . .');
        await broadcaster.broadcast(testListing, testEvent);
    } catch (error) {
        console.error('Error during test:', error);
    }
}

main();