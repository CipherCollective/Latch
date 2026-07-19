// Midnight's indexer client imports isomorphic-ws for Node. In a browser the
// native WebSocket implementation is the correct transport.
const BrowserWebSocket = globalThis.WebSocket;

export default BrowserWebSocket;
export { BrowserWebSocket as WebSocket };
