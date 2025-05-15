import express from 'express'; import cors from 'cors';

const app = express(); app.use(cors()); app.use(express.json()); // Para interpretar o body JSON dos POST

let clients = [];

// Função para mandar evento a todos. A função recebe o nome do evento e os dados. 
// Monta o payload usando o protocolo SSE para eventos customizados. 
// O bloco "event:" define o tipo do evento e "data:" envia o JSON. 
function broadcast(eventName, data) { const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`; 
clients.forEach(res => res.write(payload)); }

// Endpoint SSE para manter a conexão aberta 
app.get('/sse', (req, res) => { res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 
	Connection: 'keep-alive' }); // Escreve algo para estabelecer a conexão 
	res.write('\n'); clients.push(res);

// Remove o cliente se a conexão for encerrada 
req.on('close', () => { clients = clients.filter(c => c !== res); }); });

// Endpoint para atualizar a lista de conversas 
app.post('/webhook/list-chat', (req, res) => { // Emite um evento do tipo "conversations" que o front-end pode escutar 
broadcast('conversations', req.body); res.sendStatus(200); });

// Endpoint para atualizar as mensagens da conversa ativa 
app.post('/webhook/get-message', (req, res) => { // Emite um evento do tipo "messages" 
broadcast('messages', req.body); res.sendStatus(200); });

// Exemplo: dispara um evento a cada 5s (substitua pela lógica real) 
setInterval(async () => { // Aqui você pode, por exemplo, chamar seu webhook n8n ou consultar um DB // Exemplo: // 
const updates = await fetch('https://recntech-n8n-webhook.7schuw.easypanel.host/webhook/sse') // .then(r => r.json()); // broadcast('conversations', updates); }, 5000);

app.listen(3001, () => console.log('SSE server ouvindo na porta 3001'));
