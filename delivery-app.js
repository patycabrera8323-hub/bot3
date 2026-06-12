/* ==========================================
   NEXUS AI - DELIVERY DRIVER BOARD LOGIC
   Supports Role-Based Access Control and Multi-Restaurant Delivery Management
   ========================================== */

import { 
  db, 
  isFirebaseEnabled, 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc, 
  query,
  where,
  getDocs
} from './firebase-config.js';

let orders = [];
let driverRestaurantId = "";
let ordersUnsubscribe = null;

// --- DOM ELEMENTS REFERENCE ---
const DOM = {
  delivWaitingCount: document.getElementById("deliv-waiting-count"),
  delivActiveCount: document.getElementById("deliv-active-count"),
  delivColPrepared: document.getElementById("deliv-col-prepared"),
  delivColTransit: document.getElementById("deliv-col-transit"),
  delivColCompleted: document.getElementById("deliv-col-completed"),

  // Login Modal
  modalLogin: document.getElementById("modal-login"),
  formLogin: document.getElementById("form-login"),
  loginEmail: document.getElementById("login-email"),
  loginErrorMsg: document.getElementById("login-error-msg")
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  setupLoginHandler();
});

// Setup Verification Logic for Delivery Drivers
function setupLoginHandler() {
  DOM.formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = DOM.loginEmail.value.trim().toLowerCase();
    DOM.loginErrorMsg.style.display = "none";
    
    if (!email) return;

    if (isFirebaseEnabled) {
      try {
        const q = query(collection(db, "usuarios"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          DOM.loginErrorMsg.innerText = "Acceso denegado. El correo no está registrado como repartidor.";
          DOM.loginErrorMsg.style.display = "block";
          return;
        }

        let isAuthorized = false;
        querySnapshot.forEach((docSnap) => {
          const u = docSnap.data();
          if (u.role === "repartidor" || u.role === "admin") {
            isAuthorized = true;
            driverRestaurantId = u.restaurantId || "burger-shack";
          }
        });

        if (isAuthorized) {
          DOM.modalLogin.classList.remove("active");
          startDeliveryConsole();
        } else {
          DOM.loginErrorMsg.innerText = "Acceso denegado. Este correo no tiene privilegios de repartidor.";
          DOM.loginErrorMsg.style.display = "block";
        }
      } catch (err) {
        console.error("Firebase Auth Error:", err);
        DOM.loginErrorMsg.innerText = `Error al verificar: ${err.message}`;
        DOM.loginErrorMsg.style.display = "block";
      }
    } else {
      // Local fallback testing accounts
      if (email === "reparto@nexus.com") {
        driverRestaurantId = "burger-shack";
        DOM.modalLogin.classList.remove("active");
        startDeliveryConsole();
      } else {
        DOM.loginErrorMsg.innerText = "Acceso denegado. En modo local prueba con 'reparto@nexus.com'.";
        DOM.loginErrorMsg.style.display = "block";
      }
    }
  });
}

function startDeliveryConsole() {
  loadOrders();
}

function loadOrders() {
  if (ordersUnsubscribe) {
    ordersUnsubscribe();
  }

  if (isFirebaseEnabled) {
    const q = query(collection(db, "pedidos"), where("restaurantId", "==", driverRestaurantId));
    ordersUnsubscribe = onSnapshot(q, (snapshot) => {
      const fbOrders = [];
      snapshot.forEach((doc) => {
        fbOrders.push({ firestoreId: doc.id, ...doc.data() });
      });
      orders = fbOrders;
      localStorage.setItem(`nexus_orders_${driverRestaurantId}`, JSON.stringify(orders));
      renderDeliveryBoard();
    });
  } else {
    // Local fallback: filter orders by driver's restaurant
    const allOrders = JSON.parse(localStorage.getItem("nexus_orders")) || [];
    orders = allOrders.filter(o => o.restaurantId === driverRestaurantId);
    renderDeliveryBoard();
  }
}

function renderDeliveryBoard() {
  DOM.delivColPrepared.innerHTML = "";
  DOM.delivColTransit.innerHTML = "";
  DOM.delivColCompleted.innerHTML = "";
  
  const waitingOrders = orders.filter(o => o.status === "pendiente" || o.status === "preparando");
  const activeOrders = orders.filter(o => o.status === "transit");
  const completedOrders = orders.filter(o => o.status === "completed");
  
  DOM.delivWaitingCount.innerText = waitingOrders.length;
  DOM.delivActiveCount.innerText = activeOrders.length;
  
  // Column 1: Ready / Cooking
  if (waitingOrders.length === 0) {
    DOM.delivColPrepared.innerHTML = `<div class="no-orders-placeholder">No hay pedidos pendientes.</div>`;
  } else {
    waitingOrders.forEach(o => DOM.delivColPrepared.appendChild(createDeliveryCard(o)));
  }
  
  // Column 2: In transit
  if (activeOrders.length === 0) {
    DOM.delivColTransit.innerHTML = `<div class="no-orders-placeholder">No hay repartidores en ruta.</div>`;
  } else {
    activeOrders.forEach(o => DOM.delivColTransit.appendChild(createDeliveryCard(o)));
  }
  
  // Column 3: Completed
  if (completedOrders.length === 0) {
    DOM.delivColCompleted.innerHTML = `<div class="no-orders-placeholder">No hay entregas registradas hoy.</div>`;
  } else {
    completedOrders.forEach(o => DOM.delivColCompleted.appendChild(createDeliveryCard(o)));
  }
}

function createDeliveryCard(order) {
  const card = document.createElement("div");
  card.className = "delivery-order-card";
  
  const itemsText = order.items.map(i => `${i.qty}x ${i.name}`).join(", ");
  const refId = order.firestoreId || order.id;
  
  card.innerHTML = `
    <div class="deliv-card-header">
      <h4>#${order.id.replace("NEX-","")}</h4>
      <span class="deliv-time">${order.time}</span>
    </div>
    <div class="deliv-client-info">
      <p>${order.customer}</p>
      <span>📍 ${order.address}</span>
      <span>📞 ${order.phone}</span>
    </div>
    <div class="deliv-items-summary">
      ${itemsText}
    </div>
    <div class="deliv-card-footer">
      <span class="deliv-price">$${order.total.toFixed(2)}</span>
      <div id="btn-container-${order.id}"></div>
    </div>
  `;
  
  // Create and append status button directly
  const btnContainer = card.querySelector(`#btn-container-${order.id}`);
  const btn = renderDeliveryCardButton(order, refId);
  if (btn) btnContainer.appendChild(btn);
  
  return card;
}

function renderDeliveryCardButton(order, refId) {
  const btn = document.createElement("button");
  btn.className = "primary-btn btn-sm";
  btn.style.padding = "6px 12px";
  btn.style.fontSize = "0.75rem";
  
  if (order.status === "pendiente") {
    btn.innerText = "Cocinar";
    btn.onclick = () => advanceOrderStatus(refId, "preparando");
    return btn;
  } else if (order.status === "preparando") {
    btn.innerText = "Iniciar Reparto";
    btn.style.background = "var(--color-info)";
    btn.style.boxShadow = "var(--shadow-info-glow)";
    btn.onclick = () => advanceOrderStatus(refId, "transit");
    return btn;
  } else if (order.status === "transit") {
    btn.innerText = "Entregado ✔";
    btn.style.background = "var(--color-success)";
    btn.style.boxShadow = "var(--shadow-success-glow)";
    btn.onclick = () => advanceOrderStatus(refId, "completed");
    return btn;
  } else {
    const span = document.createElement("span");
    span.style.fontSize = "0.75rem";
    span.style.color = "var(--color-success)";
    span.style.fontWeight = "700";
    span.innerHTML = `<i class="bx bx-check"></i> Entregado`;
    return span;
  }
}

async function advanceOrderStatus(refId, nextStatus) {
  if (isFirebaseEnabled) {
    try {
      const orderRef = doc(db, "pedidos", refId);
      await updateDoc(orderRef, { status: nextStatus });
    } catch (e) {
      console.error("Error updating status in Firebase:", e);
    }
  } else {
    const allOrders = JSON.parse(localStorage.getItem("nexus_orders")) || [];
    const order = allOrders.find(o => o.firestoreId === refId || o.id === refId);
    if (order) {
      order.status = nextStatus;
      localStorage.setItem("nexus_orders", JSON.stringify(allOrders));
      loadOrders();
    }
  }
}
