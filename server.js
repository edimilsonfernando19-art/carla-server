const http = require("http");

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.OPENAI_API_KEY;

const html = `
<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CARLA — Assistente IA</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f4f6f8;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.chat {
  width: 100%;
  max-width: 600px;
  height: 100vh;
  max-height: 850px;
  background: white;
  display: flex;
  flex-direction: column;
}

.header {
  background: #111827;
  color: white;
  padding: 18px;
  text-align: center;
  font-size: 22px;
  font-weight: bold;
}

.status {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
}

.message {
  margin-bottom: 14px;
  padding: 12px 15px;
  border-radius: 15px;
  max-width: 85%;
  line-height: 1.5;
  white-space: pre-wrap;
}

.user {
  background: #2563eb;
  color: white;
  margin-left: auto;
}

.carla {
  background: #e5e7eb;
  color: #111827;
  margin-right: auto;
}

.input-area {
  display: flex;
  padding: 12px;
  border-top: 1px solid #ddd;
  gap: 8px;
}

input {
  flex: 1;
  padding: 13px;
  border: 1px solid #ccc;
  border-radius: 25px;
  outline: none;
  font-size: 16px;
}

button {
  border: none;
  background: #2563eb;
  color: white;
  padding: 0 20px;
  border-radius: 25px;
  font-size: 16px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
}
</style>
</head>

<body>

<div class="chat">

  <div class="header">
    CARLA
    <div class="status">Assistente virtual de inteligência artificial</div>
  </div>

  <div id="messages" class="messages">
    <div class="message carla">
      Olá! Eu sou a CARLA. Como posso ajudar?
    </div>
  </div>

  <div class="input-area">
    <input
      id="input"
      type="text"
      placeholder="Escreva uma mensagem..."
      autocomplete="off"
    />
    <button id="send">Enviar</button>
  </div>

</div>

<script>
const input = document.getElementById("input");
const send = document.getElementById("send");
const messages = document.getElementById("messages");

const conversation = [];

function addMessage(text, type) {
  const div = document.createElement("div");
  div.className = "message " + type;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

async function sendMessage() {

  const text = input.value.trim();

  if (!text) return;

  addMessage(text, "user");

  conversation.push({
    role: "user",
    content: text
  });

  input.value = "";
  send.disabled = true;

  const loading = document.createElement("div");
  loading.className = "message carla";
  loading.textContent = "A CARLA está a pensar...";
  messages.appendChild(loading);
  messages.scrollTop = messages.scrollHeight;

  try {

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: conversation
      })
    });

    const data = await response.json();

    loading.remove();

    if (!response.ok) {
      throw new Error(data.error || "Erro ao comunicar com a CARLA.");
    }

    addMessage(data.reply, "carla");

    conversation.push({
      role: "assistant",
      content: data.reply
    });

  } catch (error) {

    loading.remove();

    addMessage(
      "Desculpa, ocorreu um erro. Tenta novamente.",
      "carla"
    );

    console.error(error);
  }

  send.disabled = false;
  input.focus();
}

send.addEventListener("click", sendMessage);

input.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});
</script>

</body>
</html>
`;

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {

    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      resolve(body);
    });

    req.on("error", reject);
  });
}

async function askOpenAI(messages) {

  const conversation = messages
    .map(message => {
      return message.role + ": " + message.content;
    })
    .join("\\n");

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + API_KEY
      },

      body: JSON.stringify({
        model: "gpt-5-mini",
        instructions:
          "Você é CARLA, uma assistente virtual amigável, inteligente e natural. Responda em português de forma clara, útil e humana.",
        input: conversation
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    throw new Error(
      data.error?.message || "Erro na API da OpenAI."
    );
  }

  return data.output_text || "Não consegui gerar uma resposta.";
}

const server = http.createServer(async (req, res) => {

  if (req.method === "GET" && req.url === "/") {

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    res.end(html);

    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {

    try {

      if (!API_KEY) {
        sendJSON(res, 500, {
          error: "OPENAI_API_KEY não está configurada no Render."
        });

        return;
      }

      const body = await readBody(req);

      const parsed = JSON.parse(body);

      const messages = Array.isArray(parsed.messages)
        ? parsed.messages
        : [];

      if (messages.length === 0) {
        sendJSON(res, 400, {
          error: "Nenhuma mensagem recebida."
        });

        return;
      }

      const reply = await askOpenAI(messages);

      sendJSON(res, 200, {
        reply
      });

    } catch (error) {

      console.error(error);

      sendJSON(res, 500, {
        error: error.message || "Erro interno do servidor."
      });
    }

    return;
  }

  res.writeHead(404);
  res.end("Página não encontrada.");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("CARLA funcionando na porta " + PORT);
});
