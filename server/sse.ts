import { type Response, type Request, type Express } from 'express';

type SSEPayload = any;

const clients: Set<Response> = new Set();

export function registerSSE(app: Express) {
  app.get('/api/cards/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    // send a comment to keep connection alive
    res.write(': connected\n\n');

    clients.add(res);

    req.on('close', () => {
      clients.delete(res);
    });
  });
}

export function broadcast(event: SSEPayload) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    try {
      res.write(data);
    } catch (err) {
      // ignore write errors and remove client
      clients.delete(res);
    }
  }
}

// Heartbeat/tick broadcaster — emits a lightweight tick event to all SSE clients.
let _tickInterval: NodeJS.Timeout | null = null;
function startHeartbeat() {
  if (_tickInterval) return;
  const ms = Number(process.env.WEBSOCKET_PULSE_MS || "1000");
  _tickInterval = setInterval(() => {
    try {
      broadcast({ type: 'tick', ts: Date.now() });
    } catch (e) {
      // ignore
    }
  }, ms);
}

// start heartbeat automatically
startHeartbeat();
