/* ==========================================
   NEXUS AI - CLIENT CHATBOT INTERACTIVE SCRIPT
   ========================================== */

import { db, isFirebaseEnabled, collection, onSnapshot, query, getDocs, doc } from './firebase-config.js';

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

let currentRestaurantId = "";
let activeBusiness = null;

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
  btnToggleGemini: document.getElementById("btn-toggle-gemini"),

  // Views & Directory DOM
  directoryView: document.getElementById("directory-view"),
  chatbotView: document.getElementById("chatbot-view"),
  businessesGrid: document.getElementById("businesses-grid"),
  btnBackToDirectory: document.getElementById("btn-back-to-directory"),
  chatBotLogo: document.getElementById("chat-bot-logo"),
  chatBotDefaultIcon: document.getElementById("chat-bot-default-icon"),
  chatBusinessName: document.getElementById("chat-business-name"),
  chatBusinessSchedule: document.getElementById("chat-business-schedule"),
  welcomeMessageText: document.getElementById("welcome-message-text"),
  msgBtnCatalog: document.getElementById("msg-btn-catalog")
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  updateAIModelBadge();
  setupEventListeners();
  syncProductsData();
  
  // Route check: check URL for active business parameter
  const urlParams = new URLSearchParams(window.location.search);
  const restId = urlParams.get("restaurante");
  
  if (restId) {
    currentRestaurantId = restId;
    loadActiveBusinessAndStartChat(restId);
  } else {
    showBusinessesDirectory();
  }
  
  checkIncomingOrderRedirects();
}

async function loadActiveBusinessAndStartChat(restId) {
  DOM.directoryView.style.display = "none";
  DOM.chatbotView.style.display = "block";
  
  if (isFirebaseEnabled) {
    try {
      const docRef = doc(db, "businesses", restId);
      onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          activeBusiness = { id: docSnap.id, ...docSnap.data() };
          updateChatHeaderWithBusiness(activeBusiness);
        } else {
          console.error("Negocio no encontrado:", restId);
          goBackToDirectory();
        }
      });
    } catch (err) {
      console.error("Error cargando negocio:", err);
      goBackToDirectory();
    }
  } else {
    // Local mock fallback
    const mockRestaurants = {
      "burger-shack": { name: "Burger Shack", schedule: "Mar - Dom, 12:00 a 23:00", description: "Las mejores hamburguesas gourmet smash y papas fritas trufadas.", phone: "+54 9 11 1234 5678", address: "Av. Gourmet 123", paymentMethod: "Efectivo, Tarjeta", minDeliveryAmount: "10.00" },
      "pizza-napolitana": { name: "Pizza Napolitana", schedule: "Mar - Dom, 12:00 a 23:00", description: "Pizzas artesanales cocinadas al horno de leña al estilo napolitano.", phone: "+54 9 11 8765 4321", address: "Vía Italia 456", paymentMethod: "Efectivo, Transferencia", minDeliveryAmount: "12.00" },
      "sushi-zen": { name: "Sushi Zen", schedule: "Mié - Lun, 13:00 a 23:30", description: "Rolls de sushi premium, sashimi fresco y platos calientes japoneses.", phone: "+54 9 11 5555 9999", address: "Calle Kioto 789", paymentMethod: "Tarjeta, Transferencia", minDeliveryAmount: "15.00" }
    };
    const data = mockRestaurants[restId] || { name: restId, schedule: "Mar - Dom, 12:00 a 23:00", description: "Comercio de comida variada", phone: "+54 9 11 1111 2222", address: "Calle Ficticia 123", paymentMethod: "Efectivo", minDeliveryAmount: "0.00" };
    activeBusiness = { id: restId, ...data };
    updateChatHeaderWithBusiness(activeBusiness);
  }
}

function updateChatHeaderWithBusiness(biz) {
  DOM.chatBusinessName.innerText = biz.name;
  DOM.chatBusinessSchedule.innerText = biz.schedule || "Catálogo Digital PWA";
  DOM.welcomeMessageText.innerHTML = `¡Hola! 👋 Bienvenido a <strong>${biz.name}</strong>. Soy tu asistente virtual con Inteligencia Artificial.`;
  DOM.msgBtnCatalog.href = `./catalog.html?restaurante=${biz.id}`;
  
  if (biz.logoUrl) {
    DOM.chatBotLogo.src = biz.logoUrl;
    DOM.chatBotLogo.style.display = "block";
    DOM.chatBotDefaultIcon.style.display = "none";
  } else {
    DOM.chatBotLogo.style.display = "none";
    DOM.chatBotDefaultIcon.style.display = "block";
  }
}

function goBackToDirectory() {
  currentRestaurantId = "";
  activeBusiness = null;
  
  // Clear restaurante from URL search params without reloading
  const url = new URL(window.location.href);
  url.searchParams.delete("restaurante");
  window.history.pushState({}, document.title, url.pathname);
  
  showBusinessesDirectory();
}

function showBusinessesDirectory() {
  DOM.chatbotView.style.display = "none";
  DOM.directoryView.style.display = "block";
  loadBusinessesList();
}

async function loadBusinessesList() {
  DOM.businessesGrid.innerHTML = `
    <div class="loading-spinner" style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">
      <i class="bx bx-loader-alt bx-spin" style="font-size: 2.2rem; margin-bottom: 12px; display: block; color: var(--color-primary);"></i>
      Cargando comercios disponibles...
    </div>
  `;
  
  if (isFirebaseEnabled) {
    try {
      const q = query(collection(db, "businesses"));
      onSnapshot(q, (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderBusinessesGrid(list);
      });
    } catch (err) {
      console.error("Error loading businesses directory:", err);
      DOM.businessesGrid.innerHTML = `<div class="no-data-msg" style="grid-column: 1/-1;">Error al cargar los comercios. Revisa la consola.</div>`;
    }
  } else {
    // Local fallback
    const mockList = [
      { id: "burger-shack", name: "Burger Shack", description: "Las mejores hamburguesas gourmet smash y papas fritas trufadas.", schedule: "Mar - Dom, 12:00 a 23:00", address: "Av. Gourmet 123", paymentMethod: "Efectivo, Tarjeta", minDeliveryAmount: "10.00" },
      { id: "pizza-napolitana", name: "Pizza Napolitana", description: "Pizzas artesanales cocinadas al horno de leña al estilo napolitano.", schedule: "Mar - Dom, 12:00 a 23:00", address: "Vía Italia 456", paymentMethod: "Efectivo, Transferencia", minDeliveryAmount: "12.00" },
      { id: "sushi-zen", name: "Sushi Zen", description: "Rolls de sushi premium, sashimi fresco y platos calientes japoneses.", schedule: "Mié - Lun, 13:00 a 23:30", address: "Calle Kioto 789", paymentMethod: "Tarjeta, Transferencia", minDeliveryAmount: "15.00" }
    ];
    renderBusinessesGrid(mockList);
  }
}

function renderBusinessesGrid(list) {
  DOM.businessesGrid.innerHTML = "";
  if (list.length === 0) {
    DOM.businessesGrid.innerHTML = `<div class="no-data-msg" style="grid-column: 1/-1;">No hay comercios registrados actualmente.</div>`;
    return;
  }
  
  list.forEach(biz => {
    const card = document.createElement("div");
    card.className = "card glass-card business-directory-card animate-slide-up";
    card.style.padding = "22px";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "14px";
    card.style.borderRadius = "var(--border-radius-md)";
    card.style.border = "1px solid var(--border-glass)";
    card.style.transition = "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease";
    card.style.cursor = "pointer";
    
    card.onmouseenter = () => {
      card.style.transform = "translateY(-4px)";
      card.style.borderColor = "rgba(108, 92, 231, 0.4)";
      card.style.boxShadow = "0 8px 30px rgba(108, 92, 231, 0.15)";
    };
    card.onmouseleave = () => {
      card.style.transform = "translateY(0)";
      card.style.borderColor = "var(--border-glass)";
      card.style.boxShadow = "none";
    };
    
    const logoUrl = biz.logoUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80";
    
    card.innerHTML = `
      <div style="display: flex; gap: 15px; align-items: center;">
        <img src="${logoUrl}" alt="${biz.name}" style="width: 55px; height: 55px; object-fit: cover; border-radius: 50%; border: 2px solid var(--color-primary-glow);" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80'">
        <div style="flex: 1;">
          <h3 style="margin: 0; font-size: 1.2rem; color: var(--text-main); font-weight: 700; font-family: var(--font-display);">${biz.name}</h3>
          <span class="status-badge status-badge-preparing" style="margin-top: 5px; font-size: 0.62rem; display: inline-block; text-transform: uppercase;">${biz.category || 'COMIDA'}</span>
        </div>
      </div>
      
      <p style="margin: 0; font-size: 0.82rem; color: var(--text-secondary); min-height: 38px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.45;">
        ${biz.description || 'Disfruta de la mejor calidad y servicio directamente a tu domicilio.'}
      </p>
      
      <div style="border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 12px; font-size: 0.76rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 6px;">
        <div style="display:flex; align-items:center; gap:6px;"><i class="bx bx-time" style="color: var(--color-primary); font-size: 0.95rem;"></i> <span><strong>Horario:</strong> ${biz.schedule || 'Mar - Dom, 12:00 a 23:00'}</span></div>
        <div style="display:flex; align-items:center; gap:6px;"><i class="bx bx-map" style="color: var(--color-primary); font-size: 0.95rem;"></i> <span><strong>Ubicación:</strong> ${biz.address || 'Ubicación céntrica'}</span></div>
        <div style="display:flex; align-items:center; gap:6px;"><i class="bx bx-credit-card" style="color: var(--color-primary); font-size: 0.95rem;"></i> <span><strong>Pagos:</strong> ${biz.paymentMethod || 'Efectivo, Tarjeta'}</span></div>
        <div style="display:flex; align-items:center; gap:6px;"><i class="bx bx-cycling" style="color: var(--color-primary); font-size: 0.95rem;"></i> <span><strong>Min. Delivery:</strong> $${parseFloat(biz.minDeliveryAmount || 0).toFixed(2)}</span></div>
      </div>
      
      <button class="primary-btn btn-enter-biz" style="width: 100%; margin-top: auto; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <i class="bx bx-chat"></i> Ingresar al Negocio
      </button>
    `;
    
    const enterBiz = () => {
      const url = new URL(window.location.href);
      url.searchParams.set("restaurante", biz.id);
      window.history.pushState({}, document.title, url.search);
      
      currentRestaurantId = biz.id;
      loadActiveBusinessAndStartChat(biz.id);
    };
    
    card.addEventListener("click", enterBiz);
    card.querySelector(".btn-enter-biz").addEventListener("click", (e) => {
      e.stopPropagation();
      enterBiz();
    });
    
    DOM.businessesGrid.appendChild(card);
  });
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
  if (!DOM.aiBadge) return;
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
  
  DOM.btnBackToDirectory.addEventListener("click", goBackToDirectory);
  
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
  
  // Scope products and catalog context to current business
  let catalogText = "";
  const bizProducts = products.filter(p => p._bizId === currentRestaurantId || p.restaurantId === currentRestaurantId);
  
  if (bizProducts.length > 0) {
    catalogText = bizProducts.map(p =>
      `  • ${p.name} — $${parseFloat(p.price).toFixed(2)} [${p.category || 'comida'}]: ${p.description || p.desc || ""}`
    ).join("\n");
  } else {
    catalogText = "(No hay productos disponibles en este negocio actualmente.)";
  }

  const bizName = activeBusiness ? activeBusiness.name : "este negocio";
  const bizSchedule = activeBusiness ? activeBusiness.schedule : "horario regular";
  const bizPhone = activeBusiness ? activeBusiness.phone : "no especificado";
  const bizAddress = activeBusiness ? activeBusiness.address : "no especificada";
  const bizPay = activeBusiness ? activeBusiness.paymentMethod : "Efectivo, Tarjeta";
  const bizMin = activeBusiness ? parseFloat(activeBusiness.minDeliveryAmount || 0).toFixed(2) : "0.00";
  const bizDesc = activeBusiness ? activeBusiness.description : "";

  const systemPrompt = `Eres Nexus AI, el asistente virtual inteligente de pedidos para "${bizName}" (${bizDesc || 'comida variada'}).
Responde en ESPAÑOL.

===== DATOS DE "${bizName}" =====
WhatsApp: ${bizPhone}
Horario: ${bizSchedule}
Dirección: ${bizAddress}
Formas de Pago: ${bizPay}
Pedido Mínimo a Domicilio: $${bizMin}
==================================

===== CATÁLOGO DE PRODUCTOS =====
${catalogText}
==================================

INSTRUCCIONES CLAVE:
1. Sé amable, conciso y responde en español.
2. Si el cliente quiere ver el menú, comprar o realizar un pedido, indícale que abra el enlace del Catálogo Web: [Ver Catálogo Web](./catalog.html?restaurante=${currentRestaurantId}). Explícale que al confirmar su carrito, el pedido se enviará automáticamente aquí.
3. Solo menciona productos que EXISTAN en el catálogo de "${bizName}" de arriba. Nunca inventes precios ni platos.
4. Si preguntan por métodos de pago, indica que aceptan: ${bizPay}.
5. Si preguntan por entrega a domicilio, indica que se reparte a partir de un consumo mínimo de $${bizMin}.`;

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
    appendChatMessage("bot", `Lo siento, experimenté un inconveniente al conectarme al cerebro de IA de ${bizName} (${config.provider === 'nvidia' ? 'Nemotron' : 'Gemini'}).\n\nPor favor, verifica la conexión o vuelve a intentar.`);
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
      const bizName = activeBusiness ? activeBusiness.name : "nuestro negocio";
      let reply = "";
      if (text.includes("hola") || text.includes("buenas")) {
        reply = `¡Hola! 👋 Bienvenido a **${bizName}**. ¿En qué puedo ayudarte? Puedes preguntarme sobre nuestro menú o abrir directamente nuestro [Catálogo Web](./catalog.html?restaurante=${currentRestaurantId}) para armar tu pedido.`;
      } else if (text.includes("menu") || text.includes("catalogo") || text.includes("carta") || text.includes("comprar")) {
        reply = `¡Por supuesto! 🍔 Te invito a explorar el menú de **${bizName}**. Haz clic en el enlace del [Catálogo Web](./catalog.html?restaurante=${currentRestaurantId}) para seleccionar tus productos. Al confirmar, tu orden regresará a esta conversación automáticamente.`;
      } else {
        reply = `¡Entendido! Soy la simulación de Nexus para **${bizName}**. Para experimentar respuestas 100% dinámicas de Nemotron, activa la configuración en el navbar superior.`;
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
