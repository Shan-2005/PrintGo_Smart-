async function checkDB() {
    console.log("Fetching production DB state directly...");
    const res = await fetch('https://fra.cloud.appwrite.io/v1/databases/6986ce080036e1bb2059/collections/printgo_db/documents?queries[]=orderDesc("$createdAt")&queries[]=limit(5)', {
        headers: {
            'X-Appwrite-Project': '6986c8a8001fcf92431f'
        }
    });

    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Total DB Docs:", data.total);
    console.log("Documents returned:", data.documents?.length);

    if (data.documents && data.documents.length > 0) {
        const recent = data.documents.filter(d => d.kioskId === "102");
        console.log(`\n--- FOUND ${recent.length} DOCUMENTS FOR KIOSK 102 ---`);

        recent.forEach(d => {
            console.log(`\nID: ${d.$id}`);
            console.log(`KioskId: "${d.kioskId}" (Type: ${typeof d.kioskId})`);
            console.log(`Status: "${d.status}"`);
            console.log(`Time: ${d.timestamp}`);
            console.log(`Created: ${d.$createdAt}`);
        });

        const allHandshakes = data.documents.filter(d => d.status === "CONNECTED");
        console.log(`\nTotal 'CONNECTED' documents in the last 5 records: ${allHandshakes.length}`);
    }
}

checkDB();
