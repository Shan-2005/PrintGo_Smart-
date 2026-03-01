async function testParams() {
    console.log("Testing raw endpoint...");
    const res = await fetch('https://fra.cloud.appwrite.io/v1/databases/6986ce080036e1bb2059/collections/printgo_db/documents', {
        headers: {
            'X-Appwrite-Project': '6986c8a8001fcf92431f'
        }
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

testParams();
