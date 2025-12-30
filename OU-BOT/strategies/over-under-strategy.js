const readline = require('readline');

class FastOddEvenStrategy {
    constructor() {
        this.bot = null;
        this.isRunning = false;

        // Limits
        this.tradeCount = 0;
        this.maxTrades = 99999; // Unlimited trades

        // Strategy Parameters
        this.baseStake = 0.35;
        this.stake = this.baseStake;
        this.martingaleStakes = [0.35,0.40,0.80,1.64,3.36,6.88,14.10,28.90]; // Initial stake
        this.martingaleLevel = 0;
        
        // FIX: Increased max level so martingale works (uses matches or doubles automatically)
        this.maxMartingaleLevel = 8; 

        this.duration = 1;
        this.durationUnit = 't'; // ticks

        // State
        this.lastContractId = null;
        this.waitingForExit = false;
        this.tickHistory = []; // Store last digits

        // Rate Limiting
        this.minInterval = 2000; 
        this.lastTradeTime = 0;

        // Profit/Loss Tracking & Cooldown
        this.sessionProfit = 0;
        this.takeProfit = 0.01; // Target Profit for session
        this.stopLoss = -50; // Stop Loss
        this.isInCooldown = false;
        this.cooldownDuration = 1; // 1 minute cooldown (Adjustable)
        this.cooldownEndTime = null;

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
                    console.log('>>> FAST ODD/EVEN STRATEGY ( > 5 -> ODD) <<<');
                    console.log(`Logic: [Odd, Odd] -> Even | [Even, Even] -> Odd`);
                    console.log(`Take Profit: $${this.takeProfit}, Stop Loss: $${this.stopLoss}`);
                    this.tradeCount = 0;
                    this.stake = this.baseStake;
                    this.martingaleLevel = 0;
                    this.lastContractId = null;
                    this.waitingForExit = false;
                    this.sessionProfit = 0;
                    this.isInCooldown = false;
                    this.cooldownEndTime = null;
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
        console.log('Fast Odd/Even Strategy Loaded. Type "start" to begin.');
    }

    async onTick(tick) {
        if (!this.isRunning) return;

        const now = Date.now();

        // Check if in cooldown period
        if (this.isInCooldown) {
            if (now >= this.cooldownEndTime) {
                console.log('>>> COOLDOWN COMPLETE - STARTING NEW SESSION <<<');
                this.sessionProfit = 0;
                this.stake = this.baseStake;
                this.martingaleLevel = 0;
                this.isInCooldown = false;
                this.cooldownEndTime = null;
                this.lastTradeTime = now;
            } else {
                return;
            }
        }

        // 1. Check Previous Trade if exists
        if (this.lastContractId) {
            if (this.waitingForExit) {
                const contract = await this.bot.checkContract(this.lastContractId);
                if (contract && contract.is_sold) {
                    const profit = parseFloat(contract.profit);
                    this.sessionProfit += profit;

                    console.log(`Contract ${this.lastContractId} Closed. Profit: $${profit.toFixed(2)}`);
                    console.log(`📊 Session Profit: $${this.sessionProfit.toFixed(2)}`);

                    // Check limits
                    if (this.sessionProfit >= this.takeProfit || this.sessionProfit <= this.stopLoss) {
                        console.log(`🛑 Session End. Profit: $${this.sessionProfit.toFixed(2)}`);
                        this.isInCooldown = true;
                        this.cooldownEndTime = now + this.cooldownDuration;
                        this.waitingForExit = false;
                        this.lastContractId = null;
                        return;
                    }

                    if (profit > 0) {
                        console.log(`✅ WIN! Resetting stake.`);
                        this.stake = this.baseStake;
                        this.martingaleLevel = 0;
                    } else {
                        this.martingaleLevel++;
                        if (this.martingaleLevel > this.maxMartingaleLevel) {
                            console.log(`⚠️  Max Level Reached. Resetting.`);
                            this.martingaleLevel = 0;
                        }
                        // Use defined stake or double the previous stake (Fallback)
                        this.stake = this.martingaleStakes[this.martingaleLevel] || this.stake * 2; 
                        console.log(`❌ LOSS. Next Stake = $${this.stake.toFixed(2)}`);
                    }

                    this.lastContractId = null;
                    this.waitingForExit = false;
                    this.lastTradeTime = now;
                } else {
                    return;
                }
            }
        }

        const quoteStr = Number(tick.quote).toFixed(2);
        const currentDigit = parseInt(quoteStr.slice(-1));

        this.tickHistory.push(currentDigit);
        if (this.tickHistory.length > 5) this.tickHistory.shift();

        if (now - this.lastTradeTime < this.minInterval) {
            return;
        }

        console.log(`Tick: ${quoteStr} (Digit: ${currentDigit})`);

        if (this.waitingForExit) return;

        // --- NEW LOGIC IMPLEMETATION ---
        
        // Need at least 2 digits history
        if (this.tickHistory.length < 2) return;

        const lastDigit = this.tickHistory[this.tickHistory.length - 1]; // Current
        const prevDigit = this.tickHistory[this.tickHistory.length - 2]; // Previous

        const isLastOdd = lastDigit % 2 !== 0;
        const isPrevOdd = prevDigit % 2 !== 0;

        let contractType = null;
        let prediction = null; 

        // Logic: 
        // If [Odd, Odd] -> Trade Even
        // If [Even, Even] -> Trade Odd

        if (isLastOdd && isPrevOdd) {
            contractType = 'DIGITEVEN';
            console.log(`⚡ Signal: Sequence [${prevDigit}, ${lastDigit}] is [Odd, Odd]. Trading EVEN.`);
        } else if (!isLastOdd && !isPrevOdd) {
            contractType = 'DIGITODD';
            console.log(`⚡ Signal: Sequence [${prevDigit}, ${lastDigit}] is [Even, Even]. Trading ODD.`);
        }

        // Execute Trade
        if (contractType) {
            console.log(`Buying ${contractType} at $${this.stake}...`);
            this.tradeCount++;
            this.waitingForExit = true;

            try {
                const trade = await this.bot.buy(contractType, this.stake, this.duration, this.durationUnit, prediction);
                if (trade && trade.contract_id) {
                    this.lastContractId = trade.contract_id;
                    console.log(`Trade Executed! ID: ${trade.contract_id}`);
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

module.exports = FastOddEvenStrategy;
