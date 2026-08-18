/**
 * Vite plugin that serves the /api/ routes locally during development.
 * In production (Vercel), these are handled by serverless functions in /api/.
 */
export function apiDevPlugin(env) {
    return {
        name: 'api-dev-server',
        configureServer(server) {
            // POST /api/create-order
            server.middlewares.use('/api/create-order', async (req, res) => {
                console.log(`[API] ${req.method} ${req.url}`);
                if (req.method === 'OPTIONS') {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                    res.statusCode = 200;
                    res.end();
                    return;
                }

                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
                    return;
                }

                try {
                    const body = await parseBody(req);
                    const { amount, currency = 'INR', receipt } = body;

                    if (!amount || amount <= 0) {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Invalid amount' }));
                        return;
                    }

                    // Mock order — no payment gateway
                    const orderId = `order_${Date.now()}`;
                    console.log('✅ Mock order created:', orderId);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        orderId,
                        amount: Math.round(amount * 100),
                        currency,
                        receipt: receipt || `printgo_${Date.now()}`,
                    }));
                } catch (error) {
                    console.error('❌ Order creation failed:', error.message);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Failed to create order: ' + error.message }));
                }
            });

            // POST /api/verify-payment
            server.middlewares.use('/api/verify-payment', async (req, res) => {
                console.log(`[API] ${req.method} ${req.url}`);
                if (req.method === 'OPTIONS') {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                    res.statusCode = 200;
                    res.end();
                    return;
                }

                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
                    return;
                }

                try {
                    const body = await parseBody(req);
                    const { order_id, payment_id } = body;

                    // Auto-verify — no HMAC check needed
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        verified: true,
                        paymentId: payment_id || `pay_${Date.now()}`,
                        orderId: order_id || `order_${Date.now()}`,
                    }));
                } catch (error) {
                    console.error('❌ Verification failed:', error.message);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Verification failed', verified: false }));
                }
            });
        },
    };
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(JSON.parse(data));
            } catch {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}
