import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

let clients = [];

function broadcast(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(payload));
}

app.get('/sse', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('\n');
  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

app.post('/webhook/list-chat', (req, res) => {
  broadcast('conversations', req.body);
  res.sendStatus(200);
});

app.post('/webhook/get-message', (req, res) => {
  broadcast('messages', req.body);
  res.sendStatus(200);
});

app.listen(3001, () => console.log('SSE server ouvindo na porta 3001'));
