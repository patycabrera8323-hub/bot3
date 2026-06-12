/* ==========================================
   NEXUS AI - CLIENT CHATBOT INTERACTIVE SCRIPT
   ========================================== */

import { db, isFirebaseEnabled, collection, onSnapshot, query, getDocs } from './firebase-config.js';

// --- INITIAL STATE & CONFIG ---
const DEFAULT_PRODUCTS = [
  { id: "prod-1", name: "Hamburguesa Double Smash", category: "comida", price: 12.00, desc: "Doble carne premium (120g c/u), cheddar derretido, cebolla caramelizada y salsa especial." },
  { id: "prod-2", name: "Pizza Pepperoni Suprema", category: "comida", price: 14.50, desc: "Masa artesanal delgada, salsa napolitana, mozzarella y abundante pepperoni." },
  { id: "prod-3", name: "Papas Fritas Trufa & Queso", category: "comida", price: 6.50, desc: "Papas crujientes con aceite de trufa blanca, parmesano rallado y perejil fresco." },
  { id: "prod-4", name: "Limonada de Coco & Menta", category: "bebida", price: 3.50, desc: "Batido de limón con crema de coco natural y menta fresca." }
];

let products = JSON.parse(localStorage.getItem("nexus_products")) || DEFAULT_PRODUCTS;
let config = JSON.parse(localStorage.getItem("nexus_config")) || {
  provider: "nvidia", // Default to nvidia Nemotron
  nvidiaKey: "",
  geminiKey: ""
};

// --- DOM ELEMENTS REFERENCE ---
const DOM = {
  chatMessages: document.getElementById("chat-messages"),
  chatInput: document.getElementById("chat-input-text"),
  btnSend: document.getElementById("btn-send-message"),
  btnClearChat: document.getElementById("btn-clear-chat"),
  aiBadge: document.getElementById("ai-model-badge"),
  suggestionTags: document.querySelectorAll(".suggestion-tag"),
  
  // Settings Modal
  modalSettings: document.getElementById("modal-settings"),
  btnOpenSettings: document.getElementById("btn-open-settings"),
  btnCloseSettings: document.getElementById("btn-close-settings"),
  btnCancelSettings: document.getElementById("btn-cancel-settings"),
  btnSaveSettings: document.getElementById("btn-save-settings"),
  aiProviderSelect: document.getElementById("ai-provider-select"),
  apiKeyNvidia: document.getElementById("api-key-nvidia"),
  btnToggleNvapi: document.getElementById("btn-toggle-nvapi"),
  apiKeyGemini: document.getElementById("api-key-gemini"),
  btnToggleGemini: document.getElementById("btn-toggle-gemini")
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  updateAIModelBadge();
  setupEventListeners();
  syncProductsData();
  checkIncomingOrderRedirects();
}

// Sync products catalog in real-time from ALL businesses in Firebase
async function syncProductsData() {
  if (isFirebaseEnabled) {
    try {
      // Map of bizId -> products[] for clean real-time tracking
      const productsByBiz = {};

      // 1. Get all businesses once
      const businessesSnap = await getDocs(collection(db, "businesses"));

      // 2. Subscribe to each business's products subcollection
      businessesSnap.forEach((bizDoc) => {
        const bizId = bizDoc.id;
        const bizName = bizDoc.data().name || bizId;
        productsByBiz[bizId] = [];

        const q = query(collection(db, "businesses", bizId, "products"));
        onSnapshot(q, (snapshot) => {
          // Replace this business's products
          productsByBiz[bizId] = [];
          snapshot.forEach((doc) => {
            productsByBiz[bizId].push({ id: doc.id, ...doc.data(), _bizId: bizId, _bizName: bizName });
          });

          // Merge all business products into global array
          products = Object.values(productsByBiz).flat();
          localStorage.setItem("nexus_products", JSON.stringify(products));
        });
      });
    } catch (err) {
      console.error("Error syncing products from Firebase:", err);
    }
  }
}

function updateAIModelBadge() {
  if (config.provider === "demo") {
    DOM.aiBadge.innerText = "Modelo: Demo Local Inteligente";
  } else if (config.provider === "nvidia") {
    DOM.aiBadge.innerText = "Modelo: Nemotron-3-Nano (NVIDIA)";
  } else if (config.provider === "gemini") {
    DOM.aiBadge.innerText = "Modelo: Gemini 1.5 Flash (Google)";
  }
}

// --- SYNTHESIZER NOTIFICATION SOUND ---
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.log("AudioContext blocked:", e);
  }
}

// --- PARSE ORDERS RETURNING FROM PWA CATALOG ---
function checkIncomingOrderRedirects() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const orderCreated = urlParams.get("orderCreated");
    
    if (orderCreated !== "true") return;

    const orderId = urlParams.get("orderId") || "NEX-???";
    const name = urlParams.get("name") || "Cliente";
    const total = parseFloat(urlParams.get("total") || 0);
    const address = urlParams.get("address") || "No especificada";
    const itemsRaw = urlParams.get("items") || "[]";
    
    let items = [];
    try {
      items = JSON.parse(decodeURIComponent(itemsRaw));
    } catch (parseErr) {
      console.warn("Could not parse items from URL:", parseErr);
      items = [];
    }
    
    // 1. Build receipt HTML
    const itemsHTML = items.length > 0
      ? items.map(i => `<div>${i.qty}x ${i.name} ($${(parseFloat(i.price) * i.qty).toFixed(2)})</div>`).join('')
      : "<div>Ver detalles del pedido</div>";

    const receiptHTML = `
      <div class="order-receipt">
        <h4><i class="bx bx-receipt"></i> Pedido Confirmado</h4>
        <p><strong>Pedido ID:</strong> ${orderId}</p>
        <p><strong>Cliente:</strong> ${name}</p>
        <p><strong>Dirección:</strong> ${address}</p>
        <div class="receipt-divider"></div>
        <div style="font-size: 0.8rem; line-height: 1.4; color: var(--text-secondary);">
          ${itemsHTML}
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-total">
          <span>Total:</span>
          <span>$${total.toFixed(2)}</span>
        </div>
      </div>
    `;
    
    // 2. Append user checkout message to chat
    appendChatMessage("user", `Hola, acabo de realizar mi pedido desde la web.\n\nID: ${orderId}\nCliente: ${name}\nDirección: ${address}`, receiptHTML);
    playNotificationSound();
    
    // 3. Trigger automatic AI bot reaction response
    simulateBotReactionToOrder(name, address, orderId, total);
    
    // 4. Clear URL parameters from address bar to avoid duplicate orders on refresh
    window.history.replaceState({}, document.title, window.location.pathname);

  } catch (err) {
    console.error("Error processing incoming order redirect:", err);
    // Still clear URL to avoid repeated errors
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function simulateBotReactionToOrder(customerName, address, orderId, total) {
  const loadingId = appendChatLoading();
  
  setTimeout(() => {
    removeChatLoading(loadingId);
    
    let botReply = `¡Excelente elección, **${customerName}**! 🎉\n\nHemos recibido tu pedido **${orderId}** en nuestro sistema por un total de **$${total.toFixed(2)}**.\n\n`;
    if (address.toLowerCase() === "retiro en local") {
      botReply += `El pedido estará listo para que lo retires en el local en aproximadamente **20 minutos**. ¡Te esperamos!`;
    } else {
      botReply += `El reparto a *"${address}"* tardará aproximadamente **30-40 minutos**. Ya le hemos notificado a la cola de repartidores.\n\n¿Tienes alguna indicación especial para la entrega?`;
    }
    
    appendChatMessage("bot", botReply);
    playNotificationSound();
  }, 1500);
}

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
  DOM.btnSend.addEventListener("click", handleUserMessageSend);
  DOM.chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleUserMessageSend();
  });
  
  DOM.suggestionTags.forEach(tag => {
    tag.addEventListener("click", () => {
      DOM.chatInput.value = tag.innerText.substring(2); // Strip emoji prefix
      handleUserMessageSend();
    });
  });
  
  DOM.btnClearChat.addEventListener("click", () => {
    DOM.chatMessages.innerHTML = `
      <div class="message message-bot">
        <div class="message-bubble">
          <p>¡Conversación reiniciada! ¿En qué puedo ayudarte hoy?</p>
        </div>
        <span class="message-time">Recién</span>
      </div>
    `;
  });
  
  // Settings Modal actions
  DOM.btnOpenSettings.addEventListener("click", () => {
    DOM.aiProviderSelect.value = config.provider;
    DOM.apiKeyNvidia.value = config.nvidiaKey || "";
    DOM.apiKeyGemini.value = config.geminiKey || "";
    toggleProviderFields(config.provider);
    DOM.modalSettings.classList.add("active");
  });
  
  const closeSettings = () => DOM.modalSettings.classList.remove("active");
  DOM.btnCloseSettings.addEventListener("click", closeSettings);
  DOM.btnCancelSettings.addEventListener("click", closeSettings);
  
  DOM.aiProviderSelect.addEventListener("change", (e) => {
    toggleProviderFields(e.target.value);
  });
  
  DOM.btnSaveSettings.addEventListener("click", () => {
    config.provider = DOM.aiProviderSelect.value;
    config.nvidiaKey = DOM.apiKeyNvidia.value.trim();
    config.geminiKey = DOM.apiKeyGemini.value.trim();
    
    localStorage.setItem("nexus_config", JSON.stringify(config));
    updateAIModelBadge();
    closeSettings();
    
    appendChatMessage("bot", `Configuración guardada. Ahora utilizo el cerebro de **${config.provider === 'nvidia' ? 'NVIDIA Nemotron (Proxy)' : config.provider === 'gemini' ? 'Google Gemini (Proxy)' : 'Demo Local'}**.`);
  });
  
  DOM.btnToggleGemini.addEventListener("click", () => {
    if (DOM.apiKeyGemini.type === "password") {
      DOM.apiKeyGemini.type = "text";
      DOM.btnToggleGemini.innerHTML = `<i class="bx bx-hide"></i>`;
    } else {
      DOM.apiKeyGemini.type = "password";
      DOM.btnToggleGemini.innerHTML = `<i class="bx bx-show"></i>`;
    }
  });

  DOM.btnToggleNvapi.addEventListener("click", () => {
    if (DOM.apiKeyNvidia.type === "password") {
      DOM.apiKeyNvidia.type = "text";
      DOM.btnToggleNvapi.innerHTML = `<i class="bx bx-hide"></i>`;
    } else {
      DOM.apiKeyNvidia.type = "password";
      DOM.btnToggleNvapi.innerHTML = `<i class="bx bx-show"></i>`;
    }
  });
}

function toggleProviderFields(provider) {
  document.getElementById("cfg-nvidia-group").style.display = (provider === "nvidia") ? "block" : "none";
  document.getElementById("cfg-gemini-group").style.display = (provider === "gemini") ? "block" : "none";
}

// --- APPEND MESSAGES TO CHAT BOX ---
function appendChatMessage(sender, text, htmlContent = null) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const messageDiv = document.createElement("div");
  messageDiv.className = `message message-${sender}`;
  
  let formattedText = escapeHtml(text).replace(/\n/g, "<br>");
  // Parse markdown bold **text**
  formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Parse markdown links [text](url) into styled action buttons
  formattedText = formattedText.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="msg-action-btn" style="text-decoration:none; margin-top:8px; display:inline-flex; align-items:center; gap:6px;"><i class="bx bx-book-open"></i> $1</a>');
  
  messageDiv.innerHTML = `
    <div class="message-bubble">
      ${htmlContent ? htmlContent : `<p>${formattedText}</p>`}
    </div>
    <span class="message-time">${time}</span>
  `;
  
  DOM.chatMessages.appendChild(messageDiv);
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function appendChatLoading() {
  const id = "loading-" + Date.now();
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message message-bot";
  loadingDiv.id = id;
  loadingDiv.innerHTML = `
    <div class="message-bubble" style="display: flex; gap: 4px; padding: 12px 18px;">
      <span class="dot-typing" style="width: 8px; height: 8px; border-radius:50%; background:var(--text-muted); animation: bounce 1.2s infinite ease-in-out;"></span>
      <span class="dot-typing" style="width: 8px; height: 8px; border-radius:50%; background:var(--text-muted); animation: bounce 1.2s infinite ease-in-out 0.2s;"></span>
      <span class="dot-typing" style="width: 8px; height: 8px; border-radius:50%; background:var(--text-muted); animation: bounce 1.2s infinite ease-in-out 0.4s;"></span>
    </div>
  `;
  
  DOM.chatMessages.appendChild(loadingDiv);
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
  return id;
}

function removeChatLoading(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// --- CHAT WITH BACKEND PROXY (NVIDIA / GEMINI) ---
async function handleUserMessageSend() {
  const text = DOM.chatInput.value.trim();
  if (!text) return;
  
  DOM.chatInput.value = "";
  appendChatMessage("user", text);
  
  // Build catalog context grouped by business (CAG - Context Augmented Generation)
  let catalogText = "";
  if (products.length > 0) {
    // Group by business
    const byBiz = {};
    products.forEach(p => {
      const key = p._bizId || "general";
      const name = p._bizName || key;
      if (!byBiz[key]) byBiz[key] = { name, items: [] };
      byBiz[key].items.push(p);
    });

    catalogText = Object.values(byBiz).map(biz => {
      const itemLines = biz.items.map(p =>
        `  • ${p.name} — $${parseFloat(p.price).toFixed(2)} [${p.category || 'comida'}]: ${p.description || p.desc || ""}`
      ).join("\n");
      return `📍 Negocio: ${biz.name}\n${itemLines}`;
    }).join("\n\n");
  } else {
    catalogText = "(No hay productos cargados aún. Indica al cliente que vuelva en unos momentos.)";
  }

  const systemPrompt = `Eres Nexus AI, un asistente virtual inteligente de pedidos en ESPAÑOL para una plataforma multi-negocio.
Tienes acceso al catálogo completo de TODOS los negocios registrados:

===== CATÁLOGO COMPLETO POR NEGOCIO =====
${catalogText}
==========================================

INSTRUCCIONES CLAVE:
1. Sé amable, conciso y siempre responde en español.
2. Si el cliente quiere ver el menú, comprar o hacer un pedido, envíalo al Catálogo Web con el link: [Ver Catálogo Web](./catalog.html). Explícale que al confirmar su selección, el pedido regresará automáticamente aquí.
3. Solo menciona productos que EXISTAN en el catálogo de arriba. Nunca inventes precios ni productos.
4. Si un cliente pregunta por un negocio específico, muéstrale solo los productos de ese negocio.
5. Horarios generales: Martes a Domingo, 12:00 PM a 11:00 PM (verifica con cada negocio si difieren).
6. Envíos: $2.00 a domicilio, gratis en compras mayores a $15.00.
7. Pagos aceptados: Efectivo, Transferencia Bancaria, Tarjeta de Crédito/Débito.`;

  const conversationContext = getChatContextForAPI(systemPrompt);
  const loadingId = appendChatLoading();
  
  try {
    let aiResponseText = "";
    
    if (config.provider === "demo") {
      aiResponseText = await getDemoBotResponse(text);
    } else {
      // Call Express proxy server
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: config.provider,
          messages: conversationContext,
          nvidiaKey: config.nvidiaKey,
          geminiKey: config.geminiKey
        })
      });
      
      const data = await response.json();
      if (data.success) {
        aiResponseText = data.content;
      } else {
        throw new Error(data.error || "Error en el proxy");
      }
    }
    
    removeChatLoading(loadingId);
    appendChatMessage("bot", aiResponseText);
    playNotificationSound();
    
  } catch (error) {
    console.error("AI API Call Error:", error);
    removeChatLoading(loadingId);
    appendChatMessage("bot", `Lo siento, experimenté un inconveniente al conectarme al cerebro de IA (${config.provider === 'nvidia' ? 'Nemotron' : 'Gemini'}).\n\nPor favor, verifica la consola del servidor backend o vuelve a intentar.`);
  }
}

function getChatContextForAPI(systemPrompt) {
  const bubbles = DOM.chatMessages.querySelectorAll(".message");
  const list = [{ role: "system", content: systemPrompt }];
  
  const sliceIndex = Math.max(0, bubbles.length - 6);
  for (let i = sliceIndex; i < bubbles.length; i++) {
    const el = bubbles[i];
    const isUser = el.classList.contains("message-user");
    const textEl = el.querySelector("p");
    if (textEl) {
      list.push({
        role: isUser ? "user" : "assistant",
        content: textEl.innerText
      });
    }
  }
  return list;
}

// Fallback simulated bot replies
function getDemoBotResponse(userText) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const text = userText.toLowerCase();
      let reply = "";
      if (text.includes("hola") || text.includes("buenas")) {
        reply = "¡Hola! 👋 Bienvenido a Nexus. ¿En qué puedo ayudarte? Puedes preguntarme sobre el menú o abrir directamente nuestro [Catálogo PWA](./catalog.html) para armar tu pedido.";
      } else if (text.includes("menu") || text.includes("catalogo") || text.includes("carta") || text.includes("comprar")) {
        reply = "¡Por supuesto! 🍔 Te invito a explorar nuestro catálogo web móvil. Haz clic en el enlace del [Catálogo Web](./catalog.html) para seleccionar tus antojos. Al confirmar, tu orden regresará a esta conversación automáticamente.";
      } else {
        reply = "¡Entendido! Soy una simulación. Para experimentar respuestas 100% dinámicas de Nemotron, activa la configuración en el navbar.";
      }
      resolve(reply);
    }, 1000);
  });
}

// --- PWA SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado:', reg.scope))
      .catch(err => console.log('Error de Service Worker:', err));
  });
}
