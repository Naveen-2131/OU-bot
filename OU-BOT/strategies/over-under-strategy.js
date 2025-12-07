const readline = require('readline');

class OverUnderStrategy {
    constructor() {
        this.bot = null;
        this.isRunning = false;

        // Limits
        this.tradeCount = 0;
        this.maxTrades = 9999999; // Unlimited trades

        // Strategy Parameters - Unlimited Martingale
        this.baseStake = 0.35;
        this.stake = this.baseStake;
        this.martingaleMultiplier = 1.5; // Aggressive recovery
        this.martingaleLevel = 0;

        this.duration = 1;
        this.durationUnit = 't'; // ticks

        // State
        this.lastContractId = null;
        this.waitingForExit = false;

        // Rate Limiting
        this.minInterval = 2000;
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
                    console.log('>>> UNLIMITED MARTINGALE STRATEGY <<<');
                    console.log(`Base Stake: ${this.baseStake}, Multiplier: x${this.martingaleMultiplier}`);
                    console.log('⚠️  WARNING: No cap - will trade until balance = 0 or WIN');
                    this.tradeCount = 0;
                    this.stake = this.baseStake;
                    this.martingaleLevel = 0;
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
        console.log('Over/Under Strategy Loaded (Unlimited Martingale). Type "start" to begin.');

        // Auto-start for cloud deployment
        if (process.env.AUTO_START === 'true') {
            this.isRunning = true;
            console.log('>>> AUTO-STARTED (Cloud Mode) <<<');
            console.log(`Base Stake: ${this.baseStake}, Multiplier: x${this.martingaleMultiplier}`);
            console.log('⚠️  WARNING: Unlimited Martingale - No cap!');
        }
    }

    async onTick(tick) {
        if (!this.isRunning) return;

        const now = Date.now();

        // 1. Check Previous Trade if exists
        if (this.lastContractId) {
            if (this.waitingForExit) {
                const contract = await this.bot.checkContract(this.lastContractId);
                if (contract && contract.is_sold) {
                    const profit = parseFloat(contract.profit);
                    console.log(`Contract ${this.lastContractId} Closed. Profit: $${profit}`);

                    if (profit > 0) {
                        // WIN - Reset everything
                        console.log(`✅ WIN! Level ${this.martingaleLevel} recovered. Resetting to base stake.`);
                        this.stake = this.baseStake;
                        this.martingaleLevel = 0;
                    } else {
                        // LOSS - Increase stake (NO CAP)
                        this.martingaleLevel++;
                        this.stake = parseFloat((this.stake * this.martingaleMultiplier).toFixed(2));
                        console.log(`❌ LOSS. Martingale Level ${this.martingaleLevel}: Next Stake = $${this.stake}`);

                        // Check if we have enough balance
                        if (this.bot.balance && this.stake > this.bot.balance) {
                            console.log(`⚠️  WARNING: Stake ($${this.stake}) > Balance ($${this.bot.balance})`);
                            console.log('Adjusting stake to remaining balance...');
                            this.stake = parseFloat(this.bot.balance.toFixed(2));
                            if (this.stake < 0.35) {
                                console.log('❌ INSUFFICIENT BALANCE - STOPPING');
                                this.isRunning = false;
                                return;
                            }
                        }
                    }

                    this.lastContractId = null;
                    this.waitingForExit = false;
                    this.lastTradeTime = now;
                } else {
                    return;
                }
            }
        }

        const currentDigit = parseInt(tick.quote.toString().slice(-1));
        console.log(`Tick: ${tick.quote} (Last Digit: ${currentDigit})`);

        if (now - this.lastTradeTime < this.minInterval) {
            return;
        }

        if (this.waitingForExit) return;

        // Strategy Logic: Under 5 / Over 4 (Reversed)
        let contractType = null;
        let prediction = null;

        if (currentDigit > 5) {
            contractType = 'DIGITUNDER';
            prediction = 4;
        } else {
            contractType = 'DIGITOVER';
            prediction = 5;
        }

        // Execute Trade
        if (contractType) {
            console.log(`Trigger: Last ${currentDigit}. Buying ${contractType} ${prediction} at $${this.stake}... [Level ${this.martingaleLevel}]`);
            this.tradeCount++;
            this.waitingForExit = true;

            try {
                const trade = await this.bot.buy(contractType, this.stake, this.duration, this.durationUnit, prediction);
                if (trade && trade.contract_id) {
                    this.lastContractId = trade.contract_id;
                    console.log(`Trade #${this.tradeCount} Executed! ID: ${trade.contract_id}`);
                } else {
                    this.waitingForExit = false;
                }
            } catch (e) {
                console.error('Buy Failed:', e);
                this.waitingForExit = false;
            }
        }
    }
}

module.exports = OverUnderStrategy;






