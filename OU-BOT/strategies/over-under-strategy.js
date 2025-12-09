const readline = require('readline');

class OverUnderStrategy {
    constructor() {
        this.bot = null;
        this.isRunning = false;

        // Limits
        this.tradeCount = 0;
        this.maxTrades = 100; // Unlimited trades

        // Strategy Parameters - Capped Martingale (1-6 cycle)
        this.baseStake = 0.35;
        this.stake = this.baseStake;
        this.martingaleMultiplier = 13; // Aggressive recovery
        this.martingaleLevel = 0; // Start from 0 (will become 1 on first loss)
        this.maxMartingaleLevel = 3; // Cap at level 6, then reset to 1

        this.duration = 1;
        this.durationUnit = 't'; // ticks

        // State
        this.lastContractId = null;
        this.waitingForExit = false;

        // Rate Limiting
        this.minInterval = 2000;
        this.lastTradeTime = 0;

        // Profit/Loss Tracking & Cooldown
        this.sessionProfit = 0;
        this.takeProfit = 0.50; // $10 profit target
        this.stopLoss = -20; // $10 loss limit
        this.isInCooldown = false;
        this.cooldownDuration = 60000; // 1 minute in milliseconds
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
                    console.log('>>> CYCLIC MARTINGALE STRATEGY (1-6 Loop) <<<');
                    console.log(`Base Stake: ${this.baseStake}, Multiplier: x${this.martingaleMultiplier}`);
                    console.log(`Max Level: ${this.maxMartingaleLevel} (then resets to 1)`);
                    console.log(`Take Profit: $${this.takeProfit}, Stop Loss: $${this.stopLoss}`);
                    console.log(`Cooldown Period: ${this.cooldownDuration / 1000} seconds`);
                    console.log('⚠️  Loss Pattern: 1→2→3→4→5→6→1→2→3...');
                    console.log('TIME STRATEGY: 1 Min UNDER 4 <-> 1 Min OVER 5');
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
        console.log('Over/Under Strategy Loaded (Cyclic Martingale 1-6 + Time Switch). Type "start" to begin.');

        // Auto-start for cloud deployment
        if (process.env.AUTO_START === 'true') {
            this.isRunning = true;
            console.log('>>> AUTO-STARTED (Cloud Mode) <<<');
            console.log('⚠️  Cyclic Martingale Active!');
        }
    }

    async onTick(tick) {
        if (!this.isRunning) return;

        const now = Date.now();

        // Check if in cooldown period
        if (this.isInCooldown) {
            if (now >= this.cooldownEndTime) {
                // Cooldown finished - start new session
                console.log('>>> COOLDOWN COMPLETE - STARTING NEW SESSION <<<');
                this.sessionProfit = 0;
                this.stake = this.baseStake;
                this.martingaleLevel = 0;
                this.isInCooldown = false;
                this.cooldownEndTime = null;
                this.lastTradeTime = now;
            } else {
                // Still in cooldown
                const remainingSeconds = Math.ceil((this.cooldownEndTime - now) / 1000);
                if (remainingSeconds % 10 === 0) { // Log every 10 seconds
                    console.log(`⏳ Cooldown: ${remainingSeconds}s remaining...`);
                }
                return;
            }
        }

        // 1. Check Previous Trade if exists
        if (this.lastContractId) {
            if (this.waitingForExit) {
                const contract = await this.bot.checkContract(this.lastContractId);
                if (contract && contract.is_sold) {
                    const profit = parseFloat(contract.profit);
                    this.sessionProfit += profit; // Track cumulative profit

                    console.log(`Contract ${this.lastContractId} Closed. Profit: $${profit.toFixed(2)}`);
                    console.log(`📊 Session Profit: $${this.sessionProfit.toFixed(2)} | Target: $${this.takeProfit} / $${this.stopLoss}`);

                    // Check if profit/loss target reached
                    if (this.sessionProfit >= this.takeProfit) {
                        console.log(`🎯 TAKE PROFIT REACHED! Session Profit: $${this.sessionProfit.toFixed(2)}`);
                        console.log(`⏳ Entering ${this.cooldownDuration / 1000}s cooldown...`);
                        this.isInCooldown = true;
                        this.cooldownEndTime = now + this.cooldownDuration;
                        this.waitingForExit = false;
                        this.lastContractId = null;
                        return;
                    } else if (this.sessionProfit <= this.stopLoss) {
                        console.log(`🛑 STOP LOSS HIT! Session Loss: $${this.sessionProfit.toFixed(2)}`);
                        console.log(`⏳ Entering ${this.cooldownDuration / 1000}s cooldown...`);
                        this.isInCooldown = true;
                        this.cooldownEndTime = now + this.cooldownDuration;
                        this.waitingForExit = false;
                        this.lastContractId = null;
                        return;
                    }

                    if (profit > 0) {
                        // WIN - Reset to level 0 (next trade will be level 1 if loss)
                        console.log(`✅ WIN! Level ${this.martingaleLevel} recovered. Resetting to base stake.`);
                        this.stake = this.baseStake;
                        this.martingaleLevel = 0;
                    } else {
                        // LOSS - Increase level with CYCLE (1→2→3→4→5→6→1→2→3...)
                        this.martingaleLevel++;

                        // If level exceeds 6, reset to 1
                        if (this.martingaleLevel > this.maxMartingaleLevel) {
                            console.log(`⚠️  Level ${this.martingaleLevel} exceeded max! Cycling back to Level 1`);
                            this.martingaleLevel = 1;
                            this.stake = parseFloat((this.baseStake * this.martingaleMultiplier).toFixed(2));
                        } else {
                            this.stake = parseFloat((this.stake * this.martingaleMultiplier).toFixed(2));
                        }

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

        if (now - this.lastTradeTime < this.minInterval) {
            return;
        }

        if (this.waitingForExit) return;

        // --- TIME BASED STRATEGY LOGIC ---
        // 1 Minute Cycle
        // Minute 0: Under 4
        // Minute 1: Over 5
        // Minute 2: Under 4
        // ...

        const minutesSinceEpoch = Math.floor(now / 60000); // Integer minutes
        const isPhaseUnder = (minutesSinceEpoch % 2) === 0; // Even = Under, Odd = Over

        let contractType = null;
        let prediction = null;
        let phaseName = "";

        if (isPhaseUnder) {  // Run "5 Over" Logic
            phaseName = "OVER 0";
            contractType = 'DIGITOVER';
            prediction = 0;
        } else {
            // Run "4 Under" Logic
            phaseName = "DIGITUNDER 9";
            contractType = 'DIGITUNDER';
            prediction = 9;
        }

        console.log(`Tick: ${tick.quote} (L: ${currentDigit}) | [Phase: ${phaseName}]`);

        // Execute Trade
        if (contractType) {
            console.log(`Trigger: Time Phase ${phaseName}. Buying ${contractType} ${prediction} at $${this.stake}... [Level ${this.martingaleLevel}]`);
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

