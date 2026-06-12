/* ==========================================
   NEXUS AI - CLOUDFLARE PAGES CHAT FUNCTION
   Proxies /api/chat calls to NVIDIA / Gemini
   Includes automatic fallback to Ministral 8B if Llama 3.1 Nemotron 70B fails
   ========================================== */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { provider, messages, geminiKey, nvidiaKey } = body;

    // Default API keys from environment variables or client fallback
    const NVIDIA_API_KEY = env.NVIDIA_API_KEY || "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";
    const apiKeyNvidia = nvidiaKey || NVIDIA_API_KEY;
    const apiKeyGemini = geminiKey || env.GEMINI_API_KEY;

    if (provider === 'nvidia') {
      // 1. Try Llama 3.1 Nemotron 70B first
      try {
        console.log("Attempting call to primary model: nvidia/llama-3.1-nemotron-70b-instruct");
        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKeyNvidia}`
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
          return new Response(JSON.stringify({ success: true, content: content.trim() }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          console.warn("Primary model Llama 3.1 Nemotron 70B failed with status: " + response.status + ". Trying fallback model...");
          throw new Error("Primary failed");
        }
      } catch (err) {
        // 2. Fallback to Ministral 8B
        console.log("Attempting call to backup model: mistralai/ministral-8b-instruct");
        const fallbackResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKeyNvidia}`
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
          return new Response(JSON.stringify({ success: true, content: content.trim() }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ 
            success: false, 
            error: `Both models failed. Backup Ministral 8B responded with status ${fallbackResponse.status}`,
            details: JSON.stringify(fallbackData)
          }), {
            status: fallbackResponse.status,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

    } else if (provider === 'gemini') {
      if (!apiKeyGemini) {
        return new Response(JSON.stringify({ success: false, error: "Falta la clave API de Gemini" }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Format for Gemini REST API
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

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKeyGemini}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: contents,
          systemInstruction: systemInstructionText ? {
            parts: [{ text: systemInstructionText }]
          } : undefined,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1024
          }
        })
      });

      const data = await response.json();

      if (response.ok) {
        const content = data.candidates[0].content.parts[0].text;
        return new Response(JSON.stringify({ success: true, content: content }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Gemini API responded with status ${response.status}`,
          details: JSON.stringify(data)
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      return new Response(JSON.stringify({ success: false, error: "Proveedor de IA inválido" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
