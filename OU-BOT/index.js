require('dotenv').config();
const DerivAPI = require('./lib/api');
const DerivBot = require('./lib/bot');
const SimpleTickStrategy = require('./strategies/simple-tick');
const DigitStrategy = require('./strategies/digit-strategy');
const StatsStrategy = require('./strategies/stats-strategy');
const OverUnderStrategy = require('./strategies/over-under-strategy');
const OddEvenStrategy = require('./strategies/odd-even-strategy');
const MatchesDiffersStrategy = require('./strategies/matches-differs-strategy');
const DigitRotationStrategy = require('./strategies/digit-rotation-strategy');
const MatchesStrategy = require('./strategies/matches-strategy');
const SafeProfitStrategy = require('./strategies/safe-profit-strategy');

const APP_ID = process.env.DERIV_APP_ID;
const TOKEN = process.env.DERIV_API_TOKEN;

if (!TOKEN || TOKEN === 'YOUR_API_TOKEN_HERE') {
    console.error('ERROR: Please set your DERIV_API_TOKEN in .env file');
    process.exit(1);
}

const api = new DerivAPI(APP_ID);
const strategy = new OverUnderStrategy();
// const strategy = new MatchesDiffersStrategy();
// const strategy = new DigitRotationStrategy();
// const strategy = new MatchesStrategy();
// const strategy = new SafeProfitStrategy();
const bot = new DerivBot(api, strategy);

// HTTP server for Render Web Service
const http = require('http');
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Deriv Trading Bot is running!\n');
});
server.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
});

(async () => {
    try {
        await bot.init(TOKEN);
        // Start trading on Volatility 100 Index
        await bot.startTrading('R_100');
    } catch (error) {
        console.error('Fatal Error:', error);
    }
})();
