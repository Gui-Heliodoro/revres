// sse-server.js
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

let clients = [];

// Função para mandar evento a todos
function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(payload));
}

// Endpoint SSE
app.get('/sse', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');
  clients.push(res);

  // Remove cliente quando desconectar
  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

// Exemplo: dispara evento a cada 5s (substitua pela lógica real)
setInterval(async () => {
  // Aqui você pode, por exemplo, chamar seu webhook n8n ou consultar DB
  const updates = await fetch('SSE_URL = 'https://recntech-sse-server.7schuw.easypanel.host/events').then(r => r.json());
  broadcast({ type: 'conversations', payload: updates });
}, 5000);

app.listen(3001, () => console.log('SSE server ouvindo na porta 3001'));
