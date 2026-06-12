/* ==========================================
   NEXUS AI - BACKEND EXPRESS SERVER & PROXY
   Hosts the PWA files and proxies API calls
   to NVIDIA Nemotron & Google Gemini.
   ========================================== */

const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and parsing of JSON payloads
app.use(cors());
app.use(express.json());

// Serve PWA static files from current directory
app.use(express.static(path.join(__dirname)));

// Hardcoded NVIDIA API Key from the user's screenshot
const NVIDIA_API_KEY = "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";

// --- API PROXY ROUTE ---
app.post('/api/chat', (req, res) => {
  const { provider, messages, geminiKey, nvidiaKey } = req.body;

  if (provider === 'nvidia') {
    const apiKey = nvidiaKey || NVIDIA_API_KEY;

    // Call NVIDIA Nemotron-3-Nano-Omni
    const postData = JSON.stringify({
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      messages: messages,
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: 1024,
      extra_body: {
        chat_template_kwargs: {
          enable_thinking: true
        },
        reasoning_budget: 1024
      },
      stream: false
    });

    const options = {
      hostname: 'integrate.api.nvidia.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const clientReq = https.request(options, (clientRes) => {
      let body = '';
      clientRes.on('data', (chunk) => body += chunk);
      clientRes.on('end', () => {
        try {
          if (clientRes.statusCode >= 200 && clientRes.statusCode < 300) {
            const data = JSON.parse(body);
            let content = data.choices[0].message.content || "";
            // Clean thinking tags if present in output text
            content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
            res.json({ success: true, content: content.trim() });
          } else {
            res.status(clientRes.statusCode).json({ 
              success: false, 
              error: `NVIDIA API responded with status ${clientRes.statusCode}`,
              details: body
            });
          }
        } catch (e) {
          res.status(500).json({ success: false, error: "Error parsing NVIDIA API response", details: e.message });
        }
      });
    });

    clientReq.on('error', (e) => {
      res.status(500).json({ success: false, error: "NVIDIA proxy request failed", details: e.message });
    });

    clientReq.write(postData);
    clientReq.end();

  } else if (provider === 'gemini') {
    // Call Google Gemini 1.5 Flash
    const key = geminiKey || "";
    if (!key) {
      return res.status(400).json({ success: false, error: "Falta la clave API de Gemini" });
    }

    // Format for Gemini REST API
    // Separate system message if exists
    let systemInstructionText = "";
    const contents = [];

    messages.forEach(msg => {
      if (msg.role === 'system') {
        systemInstructionText = msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    });

    const postData = JSON.stringify({
      contents: contents,
      systemInstruction: systemInstructionText ? {
        parts: [{ text: systemInstructionText }]
      } : undefined,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 1024
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const clientReq = https.request(options, (clientRes) => {
      let body = '';
      clientRes.on('data', (chunk) => body += chunk);
      clientRes.on('end', () => {
        try {
          if (clientRes.statusCode >= 200 && clientRes.statusCode < 300) {
            const data = JSON.parse(body);
            const content = data.candidates[0].content.parts[0].text;
            res.json({ success: true, content: content });
          } else {
            res.status(clientRes.statusCode).json({ 
              success: false, 
              error: `Gemini API responded with status ${clientRes.statusCode}`,
              details: body
            });
          }
        } catch (e) {
          res.status(500).json({ success: false, error: "Error parsing Gemini API response", details: e.message });
        }
      });
    });

    clientReq.on('error', (e) => {
      res.status(500).json({ success: false, error: "Gemini proxy request failed", details: e.message });
    });

    clientReq.write(postData);
    clientReq.end();

  } else {
    res.status(400).json({ success: false, error: "Proveedor de IA no válido" });
  }
});

// Fallback to index.html for navigation requests (PWA routing support)
app.get('*', (req, res, next) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` Servidor de Nexus AI iniciado con éxito`);
  console.log(` URL de acceso: http://localhost:${PORT}`);
  console.log(` Proxy NVIDIA Nemotron configurado y listo`);
  console.log(`===================================================`);
});
