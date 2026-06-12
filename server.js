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
app.post('/api/chat', async (req, res) => {
  const { provider, messages, geminiKey, nvidiaKey } = req.body;

  if (provider === 'nvidia') {
    const apiKey = nvidiaKey || NVIDIA_API_KEY;

    try {
      // 1. Try Llama 3.1 Nemotron 70B first
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "nvidia/llama-3.1-nemotron-70b-instruct",
          messages: messages,
          temperature: 0.5,
          top_p: 0.95,
          max_tokens: 1024,
          stream: false
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        let content = data.choices[0].message.content || "";
        return res.json({ success: true, content: content.trim() });
      } else {
        throw new Error(`Primary failed with status ${response.status}`);
      }
    } catch (err) {
      console.warn("Primary model failed or threw error. Trying fallback...");
      try {
        // 2. Fallback to Ministral 8B
        const fallbackResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "mistralai/ministral-8b-instruct",
            messages: messages,
            temperature: 0.5,
            top_p: 0.95,
            max_tokens: 1024,
            stream: false
          })
        });

        const fallbackData = await fallbackResponse.json();
        
        if (fallbackResponse.ok) {
          let content = fallbackData.choices[0].message.content || "";
          return res.json({ success: true, content: content.trim() });
        } else {
          return res.status(fallbackResponse.status).json({
            success: false,
            error: "Both models failed.",
            details: fallbackData
          });
        }
      } catch (fallbackErr) {
        return res.status(500).json({
          success: false,
          error: "NVIDIA proxy request failed entirely",
          details: fallbackErr.message
        });
      }
    }
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
