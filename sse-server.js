// sse-server.js
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json()); // Para parsear o corpo JSON das requisições

let clients = [];

function broadcast(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try {
      client.res.write(payload); // Modificado para usar client.res
    } catch (error) {
      console.error("[SSE] Erro ao escrever para o cliente:", error);
      // Opcional: remover cliente se der erro ao escrever
      clients = clients.filter(c => c.id !== client.id);
    }
  });
}

// Endpoint para clientes SSE se conectarem
app.get('/sse', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.flushHeaders(); // Envia os headers imediatamente

  const clientId = Date.now();
  const newClient = { id: clientId, res: res };
  clients.push(newClient);
  console.log(`[SSE] Cliente ${clientId} conectado (GET /sse). Total: ${clients.length}`);

  // Envie um comentário ou um evento de "boas-vindas" imediatamente
  res.write('id: ' + clientId + '\n'); // Opcional: enviar um ID para o evento
  res.write('event: connected\n');
  res.write('data: {"message": "Conexão SSE estabelecida com sucesso!"}\n\n'); // Envia um evento formatado

  req.on('close', () => {
    clients = clients.filter(c => c.id !== clientId);
    console.log(`[SSE] Cliente ${clientId} desconectado. Total: ${clients.length}`);
  });
});

// NOVO ENDPOINT para receber webhooks do Chatwoot
app.post('/webhook/sse', (req, res) => {
  const chatwootEvent = req.body;
  console.log("[SSE Server] Webhook do Chatwoot recebido em /webhook/sse:", JSON.stringify(chatwootEvent, null, 2));

  // Determine qual evento SSE disparar com base no evento do Chatwoot
  // O payload do webhook do Chatwoot geralmente inclui 'event' e 'data'
  // Exemplo de payload do Chatwoot para message_created:
  // {
  //   "id": message_id,
  //   "content": "Hello",
  //   "event": "message_created",
  //   "conversation": { "id": conversation_id, ... },
  //   "sender": { "id": user_id, "type": "user" ou "contact" },
  //   ...
  // }

  if (chatwootEvent.event === 'message_created') {
    // Para novas mensagens, você quer enviar os dados da mensagem para o front-end
    // Ajuste o payload para o que o seu front-end espera para o evento 'messages'
    const messageData = {
      id: chatwootEvent.id, // ID da mensagem
      content: chatwootEvent.content,
      conversation_id: chatwootEvent.conversation.id,
      sender_id: chatwootEvent.sender?.id,
      sender_type: chatwootEvent.sender?.type,
      created_at: chatwootEvent.created_at, // Timestamp da mensagem
      echo_id: message.echo_id, // Se o Chatwoot suportar e enviar de volta
      attachments: message.attachments || [] // Para futuras implementações
      // Adicione outros campos relevantes que seu front-end precisa
      // Por exemplo, informações do remetente, anexos, etc.
      // O ideal é que este payload seja o mais próximo possível do que o 
      // endpoint /webhook/get-message retorna no seu N8N, para que o front-end
      // trate ambos da mesma forma.
    };
    console.log("[SSE Server] Transmitindo evento 'messages' com payload:", messageData);
    broadcast('messages', messageData);

  } else if (chatwootEvent.event === 'conversation_created' || chatwootEvent.event === 'conversation_updated') {
    // Para atualizações de conversa, você pode querer enviar um evento 'conversations'
    // com os dados da conversa atualizada.
    // O payload do webhook do Chatwoot para conversation_updated pode ser algo como:
    // {
    //   "id": conversation_id,
    //   "status": "open",
    //   "event": "conversation_updated",
    //   "meta": { "assignee": ..., "sender": ... },
    //   "messages": [ ... last message ... ]
    //   ...
    // }
    // Você precisa extrair os dados relevantes para atualizar a lista de conversas no front-end.
    const conversationData = {
        id: chatwootEvent.id,
        accountId: chatwootEvent.account_id, // ou de onde vier o account_id
        contactName: chatwootEvent.meta?.sender?.name || chatwootEvent.meta?.sender?.phone_number || `Contato ${chatwootEvent.id}`,
        lastMessage: chatwootEvent.messages && chatwootEvent.messages.length > 0 ? chatwootEvent.messages[0].content : "Conversa atualizada",
        lastActivityTimestamp: (chatwootEvent.agent_last_seen_at || chatwootEvent.contact_last_seen_at || chatwootEvent.timestamp || Date.now()/1000) * 1000,
        stage: getStageFromLabels(chatwootEvent.labels || []), // Reutilize sua função getStageFromLabels se possível
        // ... outros campos que seu `renderConversationList` espera
    };
    console.log("[SSE Server] Transmitindo evento 'conversations' com payload:", conversationData);
    broadcast('conversations', conversationData);
  } else {
    console.log(`[SSE Server] Evento Chatwoot não tratado: ${chatwootEvent.event}`);
  }

  res.sendStatus(200); // Responde ao Chatwoot que o evento foi recebido
});

// Seus endpoints antigos, caso ainda precise deles para outros propósitos
// Caso contrário, podem ser removidos se o novo /webhook/sse cobrir tudo
app.post('/webhook/list-chat', (req, res) => {
  console.log("[SSE Server] /webhook/list-chat chamado (verifique se ainda é necessário)");
  broadcast('conversations', req.body);
  res.sendStatus(200);
});

app.post('/webhook/get-message', (req, res) => {
  console.log("[SSE Server] /webhook/get-message chamado (verifique se ainda é necessário)");
  broadcast('messages', req.body);
  res.sendStatus(200);
});

// Função getStageFromLabels (copiada do seu frontend para consistência, se necessário)
// Se esta função não for necessária aqui, pode remover.
function getStageFromLabels(labels) {
    const stagesMap = { IA: 'Atendimento IA', AGENT: 'Atendente', PHARMACIST: 'Farmacêutico', CLOSED: 'Fechado' };
    if (!Array.isArray(labels)) return '';
    if (labels.length === 0) return '';
    const lowerCaseLabels = labels.map(l => String(l).toLowerCase());
    if (lowerCaseLabels.includes('pharmacist') || lowerCaseLabels.includes(stagesMap.PHARMACIST.toLowerCase())) return 'PHARMACIST';
    if (lowerCaseLabels.includes('agent') || lowerCaseLabels.includes(stagesMap.AGENT.toLowerCase())) return 'AGENT';
    if (lowerCaseLabels.includes('ia') || lowerCaseLabels.includes('agente_ia') || lowerCaseLabels.includes(stagesMap.IA.toLowerCase())) return 'IA';
    if (lowerCaseLabels.includes('closed') || lowerCaseLabels.includes(stagesMap.CLOSED.toLowerCase())) return 'CLOSED';
    const firstLabelLower = lowerCaseLabels[0];
    const foundStageKey = Object.keys(stagesMap).find(key => key.toLowerCase() === firstLabelLower);
    if (foundStageKey) return foundStageKey;
    return labels[0];
}


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`SSE server ouvindo na porta ${PORT}`));
