import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:4001');

ws.on('open', () => {
    console.log('Connected to WebSocket server');
    ws.send(JSON.stringify({
        method: "SUBSCRIBE",
        params: ["depth@TATA_INR", "ticker@TATA_INR", "trade@TATA_INR"]
    }));
});

ws.on('message', (data) => {
    console.log('Received:', data.toString());
});

ws.on('error', (err) => {
    console.error('WebSocket error:', err);
});

setTimeout(() => {
    console.log('Closing connection');
    ws.close();
    process.exit(0);
}, 5000);
