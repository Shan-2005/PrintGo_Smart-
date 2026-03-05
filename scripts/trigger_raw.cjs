
const https = require('https');
const fs = require('fs');
const path = require('path');

// Verified Constants from .env
const PROJECT_ID = '6986c8a8001fcf92431f';
const BUCKET_ID = 'print_files';
const DB_ID = '6986ce080036e1bb2059';
const COLL_ID = 'printgo_db';
const ENDPOINT = 'fra.cloud.appwrite.io';
const API_KEY = '7cbd8b00199f36fbfc66089f2a03f4460f7f32e2be26ec97d130e927c3ff5957b44358a5daec60920a06001fc9e46a788cb9bc1f561726a88e990b7933180d19';

const imagePath = process.argv[2];
const fileName = path.basename(imagePath);
const fileContent = fs.readFileSync(imagePath);

function request(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function uploadFile() {
    console.log("🚀 Uploading to:", ENDPOINT);
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    let body = `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="fileId"\r\n\r\nunique()\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
    body += `Content-Type: image/png\r\n\r\n`;

    const footer = `\r\n--${boundary}--\r\n`;

    const options = {
        hostname: ENDPOINT,
        path: `/v1/storage/buckets/${BUCKET_ID}/files`,
        method: 'POST',
        headers: {
            'X-Appwrite-Project': PROJECT_ID,
            'X-Appwrite-Key': API_KEY,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': Buffer.byteLength(body) + fileContent.length + Buffer.byteLength(footer)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.write(body);
        req.write(fileContent);
        req.write(footer);
        req.end();
    });
}

async function createDoc(fileId) {
    console.log("🚀 Creating Job in DB:", DB_ID);
    const data = JSON.stringify({
        documentId: 'unique()',
        data: {
            fileData: JSON.stringify({ fileId, name: fileName, type: 'image/png' }),
            settings: JSON.stringify({ colorMode: 'COLOR', paperSize: 'A4', copies: 1 }),
            status: 'QUEUED',
            createdAt: new Date().toISOString(),
            kioskId: 'test_kiosk'
        }
    });

    return request({
        hostname: ENDPOINT,
        path: `/v1/databases/${DB_ID}/collections/${COLL_ID}/documents`,
        method: 'POST',
        headers: {
            'X-Appwrite-Project': PROJECT_ID,
            'X-Appwrite-Key': API_KEY,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    }, data);
}

async function main() {
    try {
        const file = await uploadFile();
        if (file.$id) {
            console.log("✅ File Uploaded:", file.$id);
            const doc = await createDoc(file.$id);
            console.log("✅ Job Created:", doc.$id);
        } else {
            console.error("❌ Upload Failed:", JSON.stringify(file, null, 2));
        }
    } catch (e) {
        console.error("❌ Error:", e);
    }
}

main();
