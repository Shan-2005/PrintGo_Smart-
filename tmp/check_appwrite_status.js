
import { Client, Databases, Query } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config({ path: '../print-agent/.env' });

const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || '6986c8a8001fcf92431f');

const databases = new Databases(client);

async function checkAppwrite() {
    console.log("Checking Appwrite Collection...");
    try {
        const dbId = process.env.VITE_APPWRITE_DATABASE_ID || '6986ce080036e1bb2059';
        const collId = process.env.VITE_APPWRITE_COLLECTION_ID || 'printgo_db';
        
        console.log(`Using Database ID: ${dbId}`);
        console.log(`Using Collection ID: ${collId}`);

        const response = await databases.listDocuments(
            dbId,
            collId,
            [Query.orderDesc('$createdAt'), Query.limit(10)]
        );

        console.log(`Found ${response.total} documents total.`);
        response.documents.forEach((doc, i) => {
            console.log(`[${i}] ID: ${doc.$id}, Status: ${doc.status}, Kiosk: ${doc.kioskId}, Created: ${doc.$createdAt}`);
        });

    } catch (e) {
        console.error("Error checking Appwrite:", e.message);
    }
}

checkAppwrite();
