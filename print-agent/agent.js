require('dotenv').config();
const sdk = require('node-appwrite');
const fs = require('fs');
const path = require('path');
const ptp = require('pdf-to-printer');
const https = require('https');

// Init SDK (Server SDK)
const client = new sdk.Client();
const databases = new sdk.Databases(client);
const storage = new sdk.Storage(client);

client
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID);
// Note: If you have an API Key, set it here. For now, we assume public/JWT access or public permissions.
// .setKey('YOUR_API_KEY'); 

const DB_ID = process.env.VITE_APPWRITE_DATABASE_ID;
const COLL_ID = process.env.VITE_APPWRITE_COLLECTION_ID;
const BUCKET_ID = process.env.VITE_APPWRITE_BUCKET_ID;

console.log('🖨️  Print Agent Started (Polling Mode)...');
console.log(`Target: ${process.env.VITE_APPWRITE_ENDPOINT}`);

async function checkJobs() {
    try {
        // List documents with status 'QUEUED' (Ready to Print)
        const response = await databases.listDocuments(
            DB_ID,
            COLL_ID,
            [
                sdk.Query.equal('status', 'QUEUED')
            ]
        );

        if (response.documents.length > 0) {
            const job = response.documents[0];
            console.log(`\n📥 Found Job: ${job.$id}`);
            await processJob(job);
        }

    } catch (error) {
        // Ignore errors to keep alive
        // console.error("Polling check failed", error.message); 
    }
}

const { PDFDocument } = require('pdf-lib');

// ... (previous setup)

async function processJob(job) {
    try {
        // 1. Parse File Data
        let fileData = {};
        try {
            fileData = JSON.parse(job.fileData);
        } catch (e) {
            console.error("Error parsing JSON", e);
            await markFailed(job.$id);
            return;
        }

        if (!fileData.fileId) {
            console.error("No fileId");
            await markFailed(job.$id);
            return;
        }

        console.log(`⬇️  Downloading: ${fileData.name}...`);

        // 2. Download
        const arrayBuffer = await storage.getFileDownload(BUCKET_ID, fileData.fileId);
        const buffer = Buffer.from(arrayBuffer);

        // Initial path as original file type
        let printFilePath = path.join(__dirname, `temp_${job.$id}_${fileData.name}`);
        fs.writeFileSync(printFilePath, buffer);

        // 3. Determine File Type and Convert if needed
        const ext = path.extname(fileData.name).toLowerCase();
        console.log(`� Processing ${fileData.name} (${ext})...`);

        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            try {
                console.log("🖼️  Converting Image to PDF...");
                const pdfDoc = await PDFDocument.create();
                let image;

                if (ext === '.png') {
                    image = await pdfDoc.embedPng(buffer);
                } else {
                    image = await pdfDoc.embedJpg(buffer);
                }

                const page = pdfDoc.addPage([image.width, image.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height,
                });

                const pdfBytes = await pdfDoc.save();
                const newPdfPath = printFilePath + '.pdf';
                fs.writeFileSync(newPdfPath, pdfBytes);

                // Switch target to the new PDF
                printFilePath = newPdfPath;
                console.log("✅ Converted to PDF");
            } catch (conversionErr) {
                console.error("❌ Image Conversion Failed:", conversionErr);
                throw conversionErr;
            }
        } else if (ext !== '.pdf') {
            console.error("❌ Unsupported file format:", ext);
            // Warn but try printing anyway? No, ptp only supports PDF.
            throw new Error("Unsupported format");
        }

        // 4. Print
        console.log(`🖨️  Printing...`);
        await ptp.print(printFilePath);
        console.log(`✅ Sent to Printer`);

        // 5. Update Status
        await databases.updateDocument(DB_ID, COLL_ID, job.$id, {
            status: 'COMPLETED'
        });

        // Cleanup
        setTimeout(() => {
            // Delete the file we printed
            try { fs.unlinkSync(printFilePath); } catch (e) { }

            // Delete original download if it was different (converted)
            const originalPath = path.join(__dirname, `temp_${job.$id}_${fileData.name}`);
            if (originalPath !== printFilePath) {
                try { fs.unlinkSync(originalPath); } catch (e) { }
            }
        }, 5000);

    } catch (err) {
        console.error("Job Failed:", err);
    }
}

async function markFailed(docId) {
    try {
        await databases.updateDocument(DB_ID, COLL_ID, docId, { status: 'ERROR' });
    } catch (e) { }
}

let isProcessing = false;

async function checkJobs() {
    if (isProcessing) return;
    isProcessing = true;

    try {
        // List documents with status 'QUEUED' (Ready to Print)
        const response = await databases.listDocuments(
            DB_ID,
            COLL_ID,
            [
                sdk.Query.equal('status', 'QUEUED'),
                sdk.Query.limit(1) // Only take one at a time
            ]
        );

        if (response.documents.length > 0) {
            const job = response.documents[0];
            console.log(`\n📥 Found Job: ${job.$id}`);

            // Double check status before processing (in case of race conditions)
            await processJob(job);
        }

    } catch (error) {
        // Ignore errors to keep alive
        // console.error("Polling check failed", error.message); 
    } finally {
        isProcessing = false;
    }
}

// Poll every 1 second
setInterval(checkJobs, 1000);
checkJobs();
