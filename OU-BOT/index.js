require('dotenv').config();
const DerivAPI = require('./lib/api');
const DerivBot = require('./lib/bot');
const SimpleTickStrategy = require('./strategies/simple-tick');
const DigitStrategy = require('./strategies/digit-strategy');
const StatsStrategy = require('./strategies/stats-strategy');
const OverUnderStrategy = require('./strategies/over-under-strategy');

const APP_ID = process.env.DERIV_APP_ID;
const TOKEN = process.env.DERIV_API_TOKEN;

if (!TOKEN || TOKEN === 'YOUR_API_TOKEN_HERE') {
    console.error('ERROR: Please set your DERIV_API_TOKEN in .env file');
    process.exit(1);
}

const api = new DerivAPI(APP_ID);
// const strategy = new DigitStrategy();
// const strategy = new StatsStrategy();
const strategy = new OverUnderStrategy();
const bot = new DerivBot(api, strategy);

(async () => {
    try {
        await bot.init(TOKEN);
        // Start trading on Volatility 100 Index
        await bot.startTrading('R_100');
    } catch (error) {
        console.error('Fatal Error:', error);
    }
})();
