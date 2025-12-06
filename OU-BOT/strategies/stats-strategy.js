const readline = require('readline');

class StatsStrategy {
    constructor() {
        this.bot = null;
        this.ticks = []; // Array of { timestamp, digit }
        this.isRunning = false;
        this.initialBalance = null;
        this.stopLoss = 10; // USD
        this.stake = 0.35;
        this.windowSize = 20000; // 20 seconds in ms
        this.maxTrades = 10;
        this.tradeCount = 0;
        this.minInterval = 300; // ms
        this.lastTradeTime = 0;

        // Setup console input
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        this.rl.on('line', (input) => {
            const command = input.trim().toLowerCase();
            if (command === 'start') {
                if (!this.isRunning) {
                    this.isRunning = true;
                    console.log('>>> TRADING STARTED <<<');
                    if (this.bot && this.initialBalance === null) {
                        this.initialBalance = this.bot.balance;
                        console.log(`Initial Balance Locked: ${this.initialBalance} USD`);
                    }
                    this.tradeCount = 0; // Reset
                    this.lastTradeTime = 0;
                }
            } else if (command === 'stop') {
                this.isRunning = false;
                console.log('>>> TRADING STOPPED <<<');
            } else {
                console.log(`Unknown command: ${command}. Type 'start' or 'stop'.`);
            }
        });
    }

    onStart(bot) {
        this.bot = bot;
        console.log('Stats Strategy Loaded. Type "start" to begin trading.');
        console.log(`Configuration: Window=${this.windowSize}ms, Stake=${this.stake}, StopLoss=${this.stopLoss}, MaxTrades=${this.maxTrades}, MinInterval=${this.minInterval}ms`);
    }

    async onTick(tick) {
        const now = Date.now();
        const lastDigit = parseInt(tick.quote.toString().slice(-1));

        // Add new tick
        this.ticks.push({ timestamp: now, digit: lastDigit });

        // Remove old ticks (> 20s)
        this.ticks = this.ticks.filter(t => now - t.timestamp <= this.windowSize);

        // Analyze frequency
        const counts = {};
        this.ticks.forEach(t => {
            counts[t.digit] = (counts[t.digit] || 0) + 1;
        });

        // Sort digits by frequency (descending)
        const sortedDigits = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

        // Display Stats
        const topDigits = sortedDigits.slice(0, 3).map(d => `${d}(${counts[d]}x)`).join(', ');

        if (!this.isRunning) {
            console.log(`Tick: ${tick.quote} | Last 20s: [${topDigits}] | Active: false`);
            return;
        }

        // Check Stop Loss
        if (this.initialBalance !== null) {
            const currentLoss = this.initialBalance - this.bot.balance;
            if (currentLoss >= this.stopLoss) {
                console.log(`!!! OPEN STOP LOSS HIT !!! Loss: ${currentLoss}. Stopping Bot.`);
                this.isRunning = false;
                return;
            }
        }

        // Trading Logic
        if (sortedDigits.length > 0) {
            const topDigit = parseInt(sortedDigits[0]);
            const count = counts[topDigit];

            // Heuristic: Only trade if the top digit has appeared at least 2 times to show some 'trend'
            if (count >= 2) {

                // Check Trade Limit
                if (this.tradeCount >= this.maxTrades) {
                    console.log(`Max Trades (${this.maxTrades}) reached. Stopping.`);
                    this.isRunning = false;
                    return;
                }

                // Check Rate Limit (300ms)
                if (now - this.lastTradeTime < this.minInterval) {
                    return;
                }

                console.log(`Top Digit: ${topDigit} (${count} times). Buying DIGITMATCH... (Trade ${this.tradeCount + 1}/${this.maxTrades})`);
                this.tradeCount++;
                this.lastTradeTime = Date.now();

                // Trade immediately (Fire & Forget)
                this.bot.buy('DIGITMATCH', this.stake, 10, 't', topDigit).catch(e => console.error('Buy Failed', e));
            }
        }
    }
}

module.exports = StatsStrategy;
