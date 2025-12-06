class DigitStrategy {
    constructor() {
        this.bot = null;
        this.ticks = [];
        this.tradeType = 'DIGITDIFF'; // or 'DIGITMATCH'
        this.prediction = 0; // The digit to match or differ from
    }

    onStart(bot) {
        this.bot = bot;
        console.log(`Digit Strategy Started. Type: ${this.tradeType}, Prediction: ${this.prediction}`);
    }

    async onTick(tick) {
        const lastDigit = parseInt(tick.quote.toString().slice(-1));
        console.log(`Tick: ${tick.quote} (Last Digit: ${lastDigit})`);

        // SIMPLE LOGIC: 
        // If the last digit is the prediction, trade immediately?
        // OR: Trade every tick? 
        // Let's do a simple pattern: Trade if last digit matches prediction (for Differs) or is different (for Matches)
        // actually, let's just trade every X ticks to simulate activity, 
        // usually users have specific logic like "if last digit was 2, buy Differs 2".

        // Example Logic: If last digit equals our prediction, buy DIGITDIFF (betting it won't happen again immediately)
        if (lastDigit === this.prediction && this.tradeType === 'DIGITDIFF') {
            console.log(`Last digit was ${lastDigit}. Betting it won't repeat (DIGITDIFF ${this.prediction})...`);
            // Contract: DIGITDIFF, Stake: 1, Duration: 1 Tick (t), Barrier: prediction
            await this.bot.buy('DIGITDIFF', 1, 1, 't', this.prediction);
        }

        // Example Logic 2: If we want to trade DIGITMATCH, maybe we wait for a specific pattern? 
        // For now let's keep it simple.
    }
}

module.exports = DigitStrategy;
