require('dotenv').config();
const DerivAPI = require('./lib/api');
const DerivBot = require('./lib/bot');
const OverUnderStrategy = require('./strategies/over-under-strategy');

const APP_ID = process.env.DERIV_APP_ID;
const TOKEN = process.env.DERIV_API_TOKEN;

if (!TOKEN || TOKEN === 'YOUR_API_TOKEN_HERE') {
    console.error('ERROR: Please set your DERIV_API_TOKEN in .env file');
    process.exit(1);
}

const api = new DerivAPI(APP_ID);
const strategy = new OverUnderStrategy();
const bot = new DerivBot(api, strategy);

// HTTP server for Render Web Service - START IMMEDIATELY
const http = require('http');
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Deriv Trading Bot is running!\n');
});

// Start HTTP server immediately
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ HTTP server listening on port ${PORT}`);
});

// Start trading bot
(async () => {
    try {
        await bot.init(TOKEN);
        await bot.startTrading('R_100');
    } catch (error) {
        console.error('Fatal Error:', error);
    }
})();
