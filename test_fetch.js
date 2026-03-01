const projectId = "6986c8a8001fcf92431f";
const dbId = "6986ce080036e1bb2059";
const collId = "printgo_db";
const url = `https://fra.cloud.appwrite.io/v1/databases/${dbId}/collections/${collId}/documents`;

fetch(url, {
    method: "GET",
    headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": projectId
    }
})
    .then(r => r.json())
    .then(data => console.log("Response:", JSON.stringify(data, null, 2)))
    .catch(e => console.error("Error:", e));
