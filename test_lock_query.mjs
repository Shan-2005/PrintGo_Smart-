import fetch from 'node-fetch';
import 'dotenv/config';

const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const dbId = process.env.VITE_APPWRITE_DATABASE_ID;
const collId = process.env.VITE_APPWRITE_COLLECTION_ID;
const kioskId = '102';

async function testLockQuery() {
    console.log(`Checking Lock For Kiosk: ${kioskId}`);

    const threeMinsAgo = new Date(Date.now() - 3 * 60000).toISOString();
    console.log(`Querying docs created AFTER: ${threeMinsAgo}`);

    try {
        const url = `${endpoint}/databases/${dbId}/collections/${collId}/documents?queries[]=equal("kioskId", ["${kioskId}"])&queries[]=greaterThan("$createdAt", ["${threeMinsAgo}"])&queries[]=orderDesc("$createdAt")&queries[]=limit(5)`;

        const res = await fetch(url, {
            headers: {
                'X-Appwrite-Project': projectId
            }
        });

        console.log(`Status: ${res.status}`);
        const data = await res.json();

        if (!res.ok) {
            console.error("Query Error Data:", data);
            return;
        }

        console.log(`Found ${data.documents.length} recent documents.`);

        for (const doc of data.documents) {
            console.log(`- ID: ${doc.$id} | Status: ${doc.status} | Created: ${doc.$createdAt}`);
        }

        const inUse = data.documents.some(doc =>
            ['CONNECTED', 'PENDING', 'QUEUED', 'PRINTING'].includes(doc.status)
        );

        console.log(`IS LOCKED RESULT: ${inUse}`);

    } catch (e) {
        console.error("Network Error:", e);
    }
}

testLockQuery();
