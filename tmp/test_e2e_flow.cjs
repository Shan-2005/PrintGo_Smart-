
const sdk = require('node-appwrite');
require('dotenv').config({ path: '../.env' }); // Load from root .env

const client = new sdk.Client();
const databases = new sdk.Databases(client);

// Configuration from your .env
const DB_ID = "6986ce080036e1bb2059";
const COLL_ID = "printgo_db";

client
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1")
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || "6986c8a8001fcf92431f");

const KIOSK_ID = null;

async function runE2ETest() {
    console.log('🚀 Starting End-to-End Local Verification...');

    try {
        // 1. Create a "QUEUED" job (Simulating a user payment success)
        console.log('1. Creating test print job (Status: QUEUED)...');
        const doc = await databases.createDocument(
            DB_ID,
            COLL_ID,
            sdk.ID.unique(),
            {
                kioskId: KIOSK_ID,
                status: 'QUEUED',
                fileData: JSON.stringify({ name: '2024-03-02 20.07.25.jpg', fileId: '69a544f90013693e390c' }),
                settings: JSON.stringify({ copies: 1, colorMode: 'COLOR', paperSize: 'A4' }),
                timestamp: Date.now(), // timestamp is number
                amount: '10.0', // amount is string
                releaseCode: '123456'
            }
        );
        console.log(`✅ Job created with ID: ${doc.$id}`);

        // 2. Monitor status transitions
        console.log('2. Monitoring job status for 15 seconds...');
        let lastStatus = 'QUEUED';

        for (let i = 0; i < 15; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const updatedDoc = await databases.getDocument(DB_ID, COLL_ID, doc.$id);

            if (updatedDoc.status !== lastStatus) {
                console.log(`📡 Status Changed: ${lastStatus} -> ${updatedDoc.status}`);
                lastStatus = updatedDoc.status;

                if (lastStatus === 'COMPLETED') {
                    console.log('✅ Success! Print Agent processed the job successfully.');
                    break;
                }
                if (lastStatus === 'ERROR') {
                    console.error('❌ Job failed at Agent side.');
                    break;
                }
            }
        }

        if (lastStatus !== 'COMPLETED') {
            console.warn('⚠️ Test timed out before job completion. Check if agent is running.');
        }

    } catch (error) {
        console.error('❌ E2E Test Error:', error.message || error);
    }
}

runE2ETest();
