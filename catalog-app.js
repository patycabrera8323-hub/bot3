/* ==========================================
   NEXUS AI - CATALOG APP LOGIC (PWA CATALOG)
   aligned with the 'admin negocios' Firebase Firestore structure
   ========================================== */

import { 
  db, 
  isFirebaseEnabled, 
  collection, 
  addDoc, 
  onSnapshot, 
  query,
  where,
  doc
} from './firebase-config.js';

const urlParams = new URLSearchParams(window.location.search);
const currentRestaurantId = urlParams.get("restaurante") || "burger-shack";

// --- INITIAL STATE & DEFAULT PRODUCTS ---
const DEFAULT_PRODUCTS = [
  {
    id: "prod-bs-1",
    name: "Hamburguesa Double Smash",
    category: "comida",
    price: 12.00,
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80",
    description: "Doble carne premium (120g c/u), queso cheddar derretido, cebolla caramelizada, pepinillos y salsa de la casa."
  },
  {
    id: "prod-pn-1",
    name: "Pizza Pepperoni Suprema",
    category: "comida",
    price: 14.50,
    imageUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=500&q=80",
    description: "Masa artesanal delgada con salsa napolitana, mozzarella, pepperoni y orégano."
  }
];

let products = [];
let cart = JSON.parse(localStorage.getItem("nexus_cart")) || [];
let minDeliveryAmount = 0.00;
let businessPaymentMethod = "";

// --- DOM ELEMENTS REFERENCE ---
const DOM = {
  catalogGrid: document.getElementById("catalog-products-grid"),
  catalogSearch: document.getElementById("catalog-search"),
  categoriesContainer: document.getElementById("catalog-categories"),
  cartToggleBtn: document.getElementById("btn-cart-toggle"),
  cartCounter: document.getElementById("cart-counter"),
  cartOverlay: document.getElementById("cart-overlay"),
  cartDrawer: document.getElementById("cart-drawer"),
  btnCartClose: document.getElementById("btn-cart-close"),
  cartItemsContainer: document.getElementById("cart-items-container"),
  cartSubtotal: document.getElementById("cart-subtotal"),
  cartTotal: document.getElementById("cart-total"),
  btnCheckout: document.getElementById("btn-checkout-submit"),
  checkoutName: document.getElementById("checkout-name"),
  checkoutPhone: document.getElementById("checkout-phone"),
  checkoutAddress: document.getElementById("checkout-address"),
  minDeliveryWarning: document.getElementById("min-delivery-warning")
};

let selectedCategory = "all";
let searchFilter = "";

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  initCatalog();
});

function initCatalog() {
  updateCartUI();
  setupEventListeners();
  loadProducts();
  loadPromos();
  
  // Set back button destination to preserve current restaurant
  const backBtn = document.querySelector(".header-logo a");
  if (backBtn) {
    backBtn.href = `./?restaurante=${currentRestaurantId}`;
  }
}

// Load products and business info from Firestore
function loadProducts() {
  if (isFirebaseEnabled) {
    // 1. Fetch business metadata
    const restRef = doc(db, "businesses", currentRestaurantId);
    onSnapshot(restRef, (docSnap) => {
      if (docSnap.exists()) {
        const restData = docSnap.data();
        minDeliveryAmount = parseFloat(restData.minDeliveryAmount || 0);
        businessPaymentMethod = restData.paymentMethod || "Efectivo";
        
        const headerTitle = document.querySelector(".logo-text h1");
        const headerDesc = document.querySelector(".logo-text p");
        if (headerTitle) headerTitle.innerHTML = `NEXUS <span class="accent-text">${restData.name.toUpperCase()}</span>`;
        if (headerDesc) headerDesc.innerText = restData.schedule || "Catálogo Digital PWA";
        
        // Update checkout placeholder/details with payment info
        DOM.checkoutAddress.placeholder = `Dirección de entrega * (Mín. envío: $${minDeliveryAmount.toFixed(2)} o 'Retiro en Local')`;
      }
    });

    // 2. Fetch products from subcollection
    const q = query(collection(db, "businesses", currentRestaurantId, "products"));
    onSnapshot(q, (snapshot) => {
      const fbProducts = [];
      snapshot.forEach((doc) => {
        fbProducts.push({ id: doc.id, ...doc.data() });
      });
      products = fbProducts;
      localStorage.setItem(`nexus_products_${currentRestaurantId}`, JSON.stringify(products));
      renderCatalog();
    }, (error) => {
      console.error("Error fetching Firestore products:", error);
      renderCatalog();
    });
  } else {
    // Local fallback
    const mockRestaurants = {
      "burger-shack": { name: "Burger Shack", schedule: "Mar - Dom, 12:00 a 23:00", paymentMethod: "Efectivo, Tarjeta", minDeliveryAmount: "10.00" },
      "pizza-napolitana": { name: "Pizza Napolitana", schedule: "Mar - Dom, 12:00 a 23:00", paymentMethod: "Efectivo, Transferencia", minDeliveryAmount: "12.00" },
      "sushi-zen": { name: "Sushi Zen", schedule: "Mié - Lun, 13:00 a 23:30", paymentMethod: "Tarjeta, Transferencia", minDeliveryAmount: "15.00" }
    };
    const restData = mockRestaurants[currentRestaurantId] || { name: currentRestaurantId, schedule: "Mar - Dom, 12:00 a 23:00", paymentMethod: "Efectivo", minDeliveryAmount: "0.00" };
    minDeliveryAmount = parseFloat(restData.minDeliveryAmount);
    businessPaymentMethod = restData.paymentMethod;
    
    const headerTitle = document.querySelector(".logo-text h1");
    const headerDesc = document.querySelector(".logo-text p");
    if (headerTitle) headerTitle.innerHTML = `NEXUS <span class="accent-text">${restData.name.toUpperCase()}</span>`;
    if (headerDesc) headerDesc.innerText = restData.schedule || "Catálogo Digital PWA";
    
    DOM.checkoutAddress.placeholder = `Dirección de entrega * (Mín. envío: $${minDeliveryAmount.toFixed(2)} o 'Retiro en Local')`;

    const allProducts = JSON.parse(localStorage.getItem("nexus_products")) || DEFAULT_PRODUCTS;
    products = allProducts.filter(p => p.restaurantId === currentRestaurantId);
    renderCatalog();
  }
}

function loadPromos() {
  if (isFirebaseEnabled) {
    const q = query(collection(db, "businesses", currentRestaurantId, "promos"));
    onSnapshot(q, (snapshot) => {
      const fbPromos = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isActive) fbPromos.push({ id: doc.id, ...data });
      });
      renderPromos(fbPromos);
    }, (err) => {
      console.error("Error loading promos:", err);
      renderPromos([]);
    });
  } else {
    // Local fallback
    const allPromos = JSON.parse(localStorage.getItem(`nexus_promos_${currentRestaurantId}`)) || [];
    renderPromos(allPromos.filter(p => p.isActive));
  }
}

function renderPromos(activePromos) {
  const container = document.getElementById("promos-container");
  const slider = document.getElementById("promos-slider");
  if (!slider || !container) return;

  if (activePromos.length === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  slider.innerHTML = "";

  activePromos.forEach(p => {
    const card = document.createElement("div");
    card.className = "card glass-card promo-card";
    card.style.minWidth = "240px";
    card.style.flex = "0 0 auto";
    card.style.padding = "12px 15px";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "6px";
    card.style.borderRadius = "var(--border-radius-md)";
    card.style.border = "1px solid var(--border-glass)";
    card.style.background = "rgba(108, 92, 231, 0.05)";

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap: 8px;">
        <h4 style="margin:0; font-size:0.92rem; color:var(--text-main); font-weight:700;">${p.title}</h4>
        <span class="status-badge status-badge-completed" style="font-family:var(--font-mono); font-weight:700; margin:0; font-size:0.7rem; padding: 2px 6px; background: rgba(108,92,231,0.2); border: 1px solid var(--color-primary); color: var(--color-primary);">${p.value}</span>
      </div>
      <p style="margin:0; font-size:0.75rem; color:var(--text-secondary); line-height:1.35; white-space: normal;">${p.description}</p>
    `;
    slider.appendChild(card);
  });
}

function renderCatalog() {
  DOM.catalogGrid.innerHTML = "";
  
  const filtered = products.filter(p => {
    const matchesCat = (selectedCategory === "all" || p.category === selectedCategory);
    const matchesSearch = p.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
                          ((p.description || p.desc || "").toLowerCase().includes(searchFilter.toLowerCase()));
    return matchesCat && matchesSearch;
  });
  
  if (filtered.length === 0) {
    DOM.catalogGrid.innerHTML = `<div class="no-data-msg">No se encontraron productos.</div>`;
    return;
  }
  
  filtered.forEach(p => {
    const imgUrl = p.imageUrl || p.img || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80";
    const descText = p.description || p.desc || "Deliciosa opción preparada con ingredientes frescos de primera calidad.";
    
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-img-wrapper">
        <img src="${imgUrl}" alt="${p.name}" class="product-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80'">
        <span class="product-tag">${p.category || 'comida'}</span>
      </div>
      <div class="product-info">
        <h4 class="product-name">${p.name}</h4>
        <p class="product-desc">${descText}</p>
        <div class="product-footer">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <button class="btn-add-cart" data-id="${p.id}" title="Añadir al carrito">
            <i class="bx bx-plus"></i>
          </button>
        </div>
      </div>
    `;
    
    card.querySelector(".btn-add-cart").addEventListener("click", () => addToCart(p.id));
    DOM.catalogGrid.appendChild(card);
  });
}

function addToCart(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod) return;
  
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: prod.id,
      name: prod.name,
      price: prod.price,
      img: prod.imageUrl || prod.img,
      qty: 1
    });
  }
  
  localStorage.setItem("nexus_cart", JSON.stringify(cart));
  updateCartUI();
  
  DOM.cartToggleBtn.classList.add("accent-text");
  setTimeout(() => DOM.cartToggleBtn.classList.remove("accent-text"), 300);
}

function updateCartUI() {
  const count = cart.reduce((total, item) => total + item.qty, 0);
  DOM.cartCounter.innerText = count;
  renderCartDrawer();
}

function renderCartDrawer() {
  DOM.cartItemsContainer.innerHTML = "";
  
  if (cart.length === 0) {
    DOM.cartItemsContainer.innerHTML = `
      <div class="empty-cart-msg">
        <i class="bx bx-cart-alt"></i>
        <p>Tu carrito está vacío</p>
      </div>
    `;
    DOM.cartSubtotal.innerText = "$0.00";
    DOM.cartTotal.innerText = "$0.00";
    checkMinDeliveryAmount(0);
    return;
  }
  
  let subtotal = 0;
  
  cart.forEach(item => {
    subtotal += item.price * item.qty;
    const imgUrl = item.img || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80";
    
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <img src="${imgUrl}" alt="${item.name}" class="cart-item-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80'">
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <p>$${item.price.toFixed(2)} c/u</p>
      </div>
      <div class="cart-qty-ctrl">
        <button class="qty-btn dec-btn" data-id="${item.id}"><i class="bx bx-minus"></i></button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn inc-btn" data-id="${item.id}"><i class="bx bx-plus"></i></button>
      </div>
    `;
    
    div.querySelector(".dec-btn").addEventListener("click", () => changeQty(item.id, -1));
    div.querySelector(".inc-btn").addEventListener("click", () => changeQty(item.id, 1));
    
    DOM.cartItemsContainer.appendChild(div);
  });
  
  DOM.cartSubtotal.innerText = `$${subtotal.toFixed(2)}`;
  DOM.cartTotal.innerText = `$${subtotal.toFixed(2)}`;
  
  checkMinDeliveryAmount(subtotal);
}

function checkMinDeliveryAmount(subtotal) {
  if (cart.length === 0) {
    DOM.minDeliveryWarning.style.display = "none";
    DOM.btnCheckout.disabled = false;
    DOM.btnCheckout.style.opacity = "1";
    DOM.btnCheckout.style.cursor = "pointer";
    return;
  }

  const address = DOM.checkoutAddress.value.trim().toLowerCase();
  const isDelivery = address !== "" && address !== "retiro en local" && address !== "retiro";
  const meetsMin = !isDelivery || subtotal >= minDeliveryAmount;

  if (isDelivery && !meetsMin) {
    DOM.minDeliveryWarning.style.display = "block";
    DOM.minDeliveryWarning.innerText = `⚠️ El pedido mínimo para entrega a domicilio es $${minDeliveryAmount.toFixed(2)}. Te faltan $${(minDeliveryAmount - subtotal).toFixed(2)}.`;
    DOM.btnCheckout.disabled = true;
    DOM.btnCheckout.style.opacity = "0.5";
    DOM.btnCheckout.style.cursor = "not-allowed";
  } else {
    DOM.minDeliveryWarning.style.display = "none";
    DOM.btnCheckout.disabled = false;
    DOM.btnCheckout.style.opacity = "1";
    DOM.btnCheckout.style.cursor = "pointer";
  }
}

function changeQty(productId, delta) {
  const item = cart.find(item => item.id === productId);
  if (!item) return;
  
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.id !== productId);
  }
  
  localStorage.setItem("nexus_cart", JSON.stringify(cart));
  updateCartUI();
}

// --- SUBMIT CHECKOUT & WRITE TO 'orders' ---
async function submitCheckout() {
  const name = DOM.checkoutName.value.trim();
  const phone = DOM.checkoutPhone.value.trim();
  let address = DOM.checkoutAddress.value.trim() || "Retiro en Local";
  
  if (!name || !phone) {
    alert("Por favor ingresa tu Nombre y Celular/WhatsApp para enviar el pedido.");
    return;
  }
  
  if (cart.length === 0) {
    alert("Tu carrito está vacío.");
    return;
  }
  
  const orderId = "NEX-" + Math.floor(1000 + Math.random() * 9000);
  const total = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const orderTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const orderData = {
    id: orderId,
    customer: name,
    phone: phone,
    address: address,
    items: [...cart],
    total: total,
    time: orderTime,
    status: "pendiente",
    storeId: currentRestaurantId, // mapped to storeId
    createdAt: Date.now()
  };
  
  // 1. Write order to 'orders' collection
  if (isFirebaseEnabled) {
    try {
      await addDoc(collection(db, "orders"), orderData);
      console.log("🔥 Pedido guardado en Firestore!");
    } catch (e) {
      console.error("Error guardando pedido en Firebase:", e);
      saveOrderToLocalStorageFallback(orderData);
    }
  } else {
    saveOrderToLocalStorageFallback(orderData);
  }
  
  // 2. Serialize items and redirect back to chatbot index.html
  const encodedItems = encodeURIComponent(JSON.stringify(cart));
  
  // Clear cart state
  cart = [];
  localStorage.setItem("nexus_cart", JSON.stringify(cart));
  
  // Redirect URL building
  const redirectUrl = `./?orderCreated=true&orderId=${orderId}&name=${encodeURIComponent(name)}&total=${total}&address=${encodeURIComponent(address)}&items=${encodedItems}&restaurante=${currentRestaurantId}`;
  
  window.location.href = redirectUrl;
}

function saveOrderToLocalStorageFallback(order) {
  const localOrders = JSON.parse(localStorage.getItem("nexus_orders")) || [];
  localOrders.push(order);
  localStorage.setItem("nexus_orders", JSON.stringify(localOrders));
}

// --- EVENT LISTENERS SETUP ---
function setupEventListeners() {
  DOM.cartToggleBtn.addEventListener("click", () => {
    DOM.cartDrawer.classList.add("active");
    DOM.cartOverlay.classList.add("active");
  });
  
  const closeCart = () => {
    DOM.cartDrawer.classList.remove("active");
    DOM.cartOverlay.classList.remove("active");
  };
  DOM.btnCartClose.addEventListener("click", closeCart);
  DOM.cartOverlay.addEventListener("click", closeCart);
  
  DOM.categoriesContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("category-tab")) {
      DOM.categoriesContainer.querySelectorAll(".category-tab").forEach(t => t.classList.remove("active"));
      e.target.classList.add("active");
      selectedCategory = e.target.dataset.category;
      renderCatalog();
    }
  });
  
  DOM.catalogSearch.addEventListener("input", (e) => {
    searchFilter = e.target.value;
    renderCatalog();
  });

  DOM.checkoutAddress.addEventListener("input", () => {
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    checkMinDeliveryAmount(subtotal);
  });
  
  DOM.btnCheckout.addEventListener("click", submitCheckout);
}
