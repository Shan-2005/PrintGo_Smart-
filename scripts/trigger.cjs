
const sdk = require('node-appwrite');
const fs = require('fs');
const path = require('path');

// Manually parse .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const client = new sdk.Client();
const databases = new sdk.Databases(client);
const storage = new sdk.Storage(client);

client
    .setEndpoint(env.VITE_APPWRITE_ENDPOINT)
    .setProject(env.VITE_APPWRITE_PROJECT_ID);

const DB_ID = env.VITE_APPWRITE_DATABASE_ID;
const COLL_ID = env.VITE_APPWRITE_COLLECTION_ID;
const BUCKET_ID = env.VITE_APPWRITE_BUCKET_ID;

const imagePath = process.argv[2];

async function run() {
    try {
        console.log("🚀 Uploading:", imagePath);
        const fileContent = fs.readFileSync(imagePath);
        const file = await storage.createFile(
            BUCKET_ID,
            sdk.ID.unique(),
            sdk.InputFile.fromBuffer(fileContent, path.basename(imagePath))
        );
        console.log("✅ File:", file.$id);

        const jobData = {
            fileData: JSON.stringify({
                fileId: file.$id,
                name: path.basename(imagePath),
                type: 'image/png'
            }),
            settings: JSON.stringify({
                colorMode: 'COLOR',
                paperSize: 'A4',
                copies: 1
            }),
            status: 'QUEUED',
            createdAt: new Date().toISOString(),
            kioskId: 'test_kiosk'
        };

        const doc = await databases.createDocument(DB_ID, COLL_ID, sdk.ID.unique(), jobData);
        console.log("✅ Job Created:", doc.$id);
    } catch (e) {
        console.error("❌ Error:", e);
    }
}

run();
