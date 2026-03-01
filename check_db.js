const fs = require('fs');
try {
    let txt = fs.readFileSync('test_output3.json', 'utf8');
    txt = txt.replace(/^\uFEFF/g, ''); // Remove BOM if present
    const match = txt.match(/\{[\s\S]*\}$/);
    if (match) {
        const data = JSON.parse(match[0]);
        console.log('Total Docs in DB:', data.total);
        console.log('Found Documents Array:', Array.isArray(data.documents) ? data.documents.length : 'Missing');

        if (data.documents) {
            const recent = data.documents.filter(d => d.status === 'CONNECTED');
            recent.sort((a, b) => new Date(b.$createdAt) - new Date(a.$createdAt));
            console.log('Total CONNECTED Handshakes:', recent.length);
            if (recent.length > 0) {
                console.log('Most Recent Handshake Data:');
                console.log(JSON.stringify(recent[0], null, 2));
            }
        }
    } else {
        console.log('No valid JSON block found in output file.');
        console.log('Raw head:', txt.substring(0, 100));
    }
} catch (e) {
    console.error('Error parsing:', e);
}
