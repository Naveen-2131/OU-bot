class DerivBot {
    constructor(api, strategy) {
        this.api = api;
        this.strategy = strategy;
        this.token = null;
        this.balance = 0;
        this.currency = 'USD';
    }

    async init(token) {
        this.token = token;
        try {
            await this.api.connect();
            await this.authorize();
            this.api.onMessage = (data) => this.handleStream(data);
        } catch (error) {
            console.error('Bot Initialization Error:', error);
            throw error;
        }
    }

    async authorize() {
        console.log('Authorizing...');
        const response = await this.api.send({ authorize: this.token });
        if (response.authorize) {
            this.balance = response.authorize.balance;
            this.currency = response.authorize.currency;
            console.log(`Authorized! Balance: ${this.balance} ${this.currency}`);
        }
    }

    async startTrading(symbol) {
        console.log(`Subscribing to ${symbol}...`);
        await this.api.send({ ticks: symbol, subscribe: 1 });
        this.strategy.onStart(this);
    }

    handleStream(data) {
        if (data.msg_type === 'tick') {
            const tick = {
                quote: data.tick.quote,
                epoch: data.tick.epoch,
                symbol: data.tick.symbol
            };
            this.strategy.onTick(tick);
        }
    }

    async buy(contractType, amount, duration, durationUnit, barrier = null) {
        console.log(`Attempting to buy ${contractType} for ${amount} (Barrier: ${barrier})...`);

        const proposal = {
            proposal: 1,
            amount: amount,
            basis: 'stake',
            contract_type: contractType,
            currency: this.currency,
            duration: duration,
            duration_unit: durationUnit,
            symbol: 'R_100'
        };

        if (barrier !== null) {
            proposal.barrier = String(barrier);
        }

        try {
            const propResponse = await this.api.send(proposal);
            if (propResponse.proposal) {
                const buyParams = {
                    buy: propResponse.proposal.id,
                    price: propResponse.proposal.ask_price
                };
                const buyResponse = await this.api.send(buyParams);
                if (buyResponse.buy) {
                    console.log(`Trade Executed! ID: ${buyResponse.buy.contract_id}`);
                    return buyResponse.buy;
                }
            } else if (propResponse.error) {
                console.error('Proposal Error:', propResponse.error.message);
            }
        } catch (error) {
            console.error('Trade Error:', error);
        }
    }

    async checkContract(contractId) {
        try {
            const response = await this.api.send({ proposal_open_contract: 1, contract_id: contractId });
            if (response.proposal_open_contract) {
                return response.proposal_open_contract;
            }
        } catch (error) {
            console.error('Check Contract Error:', error);
        }
        return null;
    }
}

module.exports = DerivBot;
