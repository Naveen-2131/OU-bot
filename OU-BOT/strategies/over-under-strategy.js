const readline = require('readline');

class OverUnderStrategy {
    constructor() {
        this.bot = null;
        this.isRunning = false;

        // Limits
        this.tradeCount = 0;
        this.maxTrades = 100;

        // Strategy Parameters
        this.baseStake = 0.35;
        this.stake = this.baseStake;
        this.martingaleMultiplier = 2.5; // Aggressive recovery

        this.duration = 1;
        this.durationUnit = 't'; // ticks

        // State
        this.lastContractId = null;
        this.waitingForExit = false;

        // Rate Limiting
        this.minInterval = 2000; // Increased interval to allow result checking
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
                    console.log('>>> OVER/UNDER MARTINGALE STRATEGY <<<');
                    console.log(`Base Stake: ${this.baseStake}, Multiplier: x${this.martingaleMultiplier}`);
                    this.tradeCount = 0;
                    this.stake = this.baseStake;
                    this.lastContractId = null;
                    this.waitingForExit = false;
                }
            } else if (command === 'stop') {
                this.isRunning = false;
                console.log('>>> STRATEGY STOPPED <<<');
            } else {
                console.log(`Unknown command: ${command}`);
            }
        });
    }

    onStart(bot) {
        this.bot = bot;
        console.log('Over/Under Strategy Loaded (Martingale Active). Type "start" to begin.');
    }

    async onTick(tick) {
        if (!this.isRunning) return;

        const now = Date.now();

        // 1. Check Previous Trade if exists
        if (this.lastContractId) {
            // If we are waiting for a result, don't trade yet
            if (this.waitingForExit) {
                const contract = await this.bot.checkContract(this.lastContractId);
                if (contract && contract.is_sold) {
                    console.log(`Contract ${this.lastContractId} Closed. Profit: ${contract.profit}`);

                    if (contract.profit > 0) {
                        console.log(`WIN! Resetting Stake to ${this.baseStake}`);
                        this.stake = this.baseStake;
                    } else {
                        this.stake = parseFloat((this.stake * this.martingaleMultiplier).toFixed(2));
                        console.log(`LOSS. Martingale: Increasing Stake to ${this.stake}`);
                    }

                    this.lastContractId = null;
                    this.waitingForExit = false;
                    this.lastTradeTime = now; // Add delay after result
                } else {
                    // Still running, wait
                    return;
                }
            }
        }

        const currentDigit = parseInt(tick.quote.toString().slice(-1));
        console.log(`Tick: ${tick.quote} (Last Digit: ${currentDigit})`);

        // Check Rate Limit (after result check)
        if (now - this.lastTradeTime < this.minInterval) {
            return;
        }

        if (this.waitingForExit) return; // Double check

        // Strategy Logic: Mean Reversion
        let contractType = null;
        let prediction = null;

        if (currentDigit < 5) {
            // Saw Low, Betting High
            contractType = 'DIGITOVER';
            prediction = 4;
        } else {
            // Saw High, Betting Low
            contractType = 'DIGITUNDER';
            prediction = 5;
        }

        // Execute Trade
        if (contractType) {
            console.log(`Trigger: Last ${currentDigit}. Buying ${contractType} ${prediction} at $${this.stake}...`);
            this.tradeCount++;
            this.waitingForExit = true; // Block new trades

            try {
                const trade = await this.bot.buy(contractType, this.stake, this.duration, this.durationUnit, prediction);
                if (trade && trade.contract_id) {
                    this.lastContractId = trade.contract_id;
                } else {
                    this.waitingForExit = false; // Failed
                }
            } catch (e) {
                console.error('Buy Failed:', e);
                this.waitingForExit = false;
            }
        }
    }
}

module.exports = OverUnderStrategy;
