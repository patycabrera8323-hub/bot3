/* ==========================================
   NEXUS AI - CLOUDFLARE PAGES CHAT FUNCTION
   Proxies /api/chat calls to NVIDIA / Gemini
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
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyNvidia}`
        },
        body: JSON.stringify({
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
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        let content = data.choices[0].message.content || "";
        // Clean thinking tags if present in output text
        content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
        return new Response(JSON.stringify({ success: true, content: content.trim() }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `NVIDIA API responded with status ${response.status}`,
          details: JSON.stringify(data)
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
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
