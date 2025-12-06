const WebSocket = require('ws');

class DerivAPI {
    constructor(appId) {
        this.appId = appId;
        this.ws = null;
        this.reqId = 0;
        this.pendingRequests = new Map();
        this.onMessage = null; // Callback for stream updates
        this.endpoint = 'wss://ws.binaryws.com/websockets/v3';
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(`${this.endpoint}?app_id=${this.appId}`);

            this.ws.on('open', () => {
                console.log('Connected to Deriv WebSocket');
                resolve();
            });

            this.ws.on('message', (data) => {
                const response = JSON.parse(data);
                this.handleMessage(response);
            });

            this.ws.on('error', (err) => {
                console.error('WebSocket Error:', err);
                reject(err);
            });

            this.ws.on('close', () => {
                console.log('WebSocket connection closed');
            });
        });
    }

    send(request) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error('WebSocket not connected'));
            }

            this.reqId++;
            request.req_id = this.reqId;
            this.pendingRequests.set(this.reqId, { resolve, reject });

            this.ws.send(JSON.stringify(request));
        });
    }

    handleMessage(response) {
        // Handle direct request responses
        if (response.req_id) {
            const request = this.pendingRequests.get(response.req_id);
            if (request) {
                if (response.error) {
                    request.reject(response.error);
                } else {
                    request.resolve(response);
                }
                this.pendingRequests.delete(response.req_id);
            }
        }

        // Handle subscriptions/streams
        if (response.subscription || response.msg_type === 'tick' || response.msg_type === 'ohlc') {
            if (this.onMessage) {
                this.onMessage(response);
            }
        }
    }
}

module.exports = DerivAPI;
