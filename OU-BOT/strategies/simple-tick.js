class SimpleTickStrategy {
    constructor() {
        this.bot = null;
        this.ticks = [];
        this.maxTicks = 5;
    }

    onStart(bot) {
        this.bot = bot;
        console.log('Simple Tick Strategy Started.');
    }

    async onTick(tick) {
        console.log(`Tick: ${tick.quote} (${new Date(tick.epoch * 1000).toLocaleTimeString()})`);
        this.ticks.push(tick);

        if (this.ticks.length > this.maxTicks) {
            this.ticks.shift();
        }

        // Logic: specific pattern check
        // DEMO ONLY: If last 3 ticks are increasing, buy CALL (Rise)
        if (this.ticks.length >= 3) {
            const last = this.ticks[this.ticks.length - 1];
            const prev = this.ticks[this.ticks.length - 2];
            const prev2 = this.ticks[this.ticks.length - 3];

            if (last.quote > prev.quote && prev.quote > prev2.quote) {
                console.log('Trend Detected: 3 Ticks UP. Buying Rise...');
                // this.bot.buy('CALL', 10, 5, 't'); // Commented out to prevent accidental spending
                console.log('>> BUY SIGNAL (Simulated) <<');
                this.ticks = []; // Reset locally to avoid spamming
            }
        }
    }
}

module.exports = SimpleTickStrategy;
