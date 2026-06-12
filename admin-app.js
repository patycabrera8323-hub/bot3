/* ==========================================
   NEXUS AI - ADMIN APP LOGIC
   Supports Role-Based Access Control and Multi-Restaurant Management
   ========================================== */

import { 
  db, 
  isFirebaseEnabled, 
  collection, 
  doc, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  setDoc,
  query,
  where,
  getDocs
} from './firebase-config.js';

// --- INITIAL STATE ---
const DEFAULT_PRODUCTS = [
  { id: "prod-bs-1", name: "Hamburguesa Double Smash", category: "comida", price: 12.00, img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80", desc: "Doble carne premium (120g c/u), cheddar derretido, cebolla caramelizada, pepinillos y salsa de la casa.", restaurantId: "burger-shack" },
  { id: "prod-pn-1", name: "Pizza Pepperoni Suprema", category: "comida", price: 14.50, img: "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=500&q=80", desc: "Masa artesanal delgada con salsa napolitana, mozzarella, pepperoni y orégano.", restaurantId: "pizza-napolitana" }
];

let products = [];
let orders = [];

// Active configuration state
let currentRestaurantId = "";
let userRole = "";
let allowedRestaurantId = ""; // "all" or specific ID (e.g. "burger-shack")
let productsUnsubscribe = null;
let ordersUnsubscribe = null;

// --- DOM ELEMENTS REFERENCE ---
const DOM = {
  adminTabs: document.querySelectorAll(".admin-tab"),
  adminSubpanels: document.querySelectorAll(".admin-subpanel"),
  adminProductsList: document.getElementById("admin-products-list"),
  adminOrdersList: document.getElementById("admin-orders-list"),
  adminPendingBadge: document.getElementById("admin-pending-badge"),
  btnAddProduct: document.getElementById("btn-add-product"),
  btnClearOrders: document.getElementById("btn-clear-orders"),
  
  // Multi-Restaurant DOM Elements
  adminRestaurantSelect: document.getElementById("admin-restaurant-select"),
  formRestaurantConfig: document.getElementById("form-restaurant-config"),
  restName: document.getElementById("rest-name"),
  restPhone: document.getElementById("rest-phone"),
  restSchedule: document.getElementById("rest-schedule"),
  restAddress: document.getElementById("rest-address"),
  restLogo: document.getElementById("rest-logo"),

  // Login Modal DOM Elements
  modalLogin: document.getElementById("modal-login"),
  formLogin: document.getElementById("form-login"),
  loginEmail: document.getElementById("login-email"),
  loginErrorMsg: document.getElementById("login-error-msg"),
  
  // Modal Product Form
  modalProductForm: document.getElementById("modal-product-form"),
  productForm: document.getElementById("form-product"),
  productModalTitle: document.getElementById("product-modal-title"),
  btnCloseProductModal: document.getElementById("btn-close-product-modal"),
  btnCancelProductModal: document.getElementById("btn-cancel-product-modal"),
  prodId: document.getElementById("prod-id"),
  prodName: document.getElementById("prod-name"),
  prodCategory: document.getElementById("prod-category"),
  prodPrice: document.getElementById("prod-price"),
  prodImg: document.getElementById("prod-img"),
  prodDesc: document.getElementById("prod-desc")
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  setupLoginHandler();
});

// Setup Verification Logic (Super Admin vs Business Owner)
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
          DOM.loginErrorMsg.innerText = "Acceso denegado. El correo no está registrado como administrador.";
          DOM.loginErrorMsg.style.display = "block";
          return;
        }

        let isAuthorized = false;
        querySnapshot.forEach((docSnap) => {
          const u = docSnap.data();
          if (u.role === "admin") {
            isAuthorized = true;
            userRole = "admin";
            allowedRestaurantId = u.restaurantId || "all";
          }
        });

        if (isAuthorized) {
          DOM.modalLogin.classList.remove("active");
          startAdminConsole();
        } else {
          DOM.loginErrorMsg.innerText = "Acceso denegado. Este correo no tiene rol de administrador.";
          DOM.loginErrorMsg.style.display = "block";
        }
      } catch (err) {
        console.error("Firebase Auth Error:", err);
        DOM.loginErrorMsg.innerText = `Error al verificar credenciales: ${err.message}`;
        DOM.loginErrorMsg.style.display = "block";
      }
    } else {
      // Local fallback testing accounts
      if (email === "searmoco@gmail.com") {
        userRole = "admin";
        allowedRestaurantId = "all";
        DOM.modalLogin.classList.remove("active");
        startAdminConsole();
      } else if (email === "jicr1200@gmail.com") {
        userRole = "admin";
        allowedRestaurantId = "burger-shack";
        DOM.modalLogin.classList.remove("active");
        startAdminConsole();
      } else {
        DOM.loginErrorMsg.innerText = "Acceso denegado. En modo local prueba con 'searmoco@gmail.com' o 'jicr1200@gmail.com'.";
        DOM.loginErrorMsg.style.display = "block";
      }
    }
  });
}

function startAdminConsole() {
  setupEventListeners();
  loadRestaurants();
}

// Load list of restaurants to populate dropdown
async function loadRestaurants() {
  if (isFirebaseEnabled) {
    try {
      const q = query(collection(db, "restaurantes"));
      const querySnapshot = await getDocs(q);
      DOM.adminRestaurantSelect.innerHTML = "";
      
      const loadedRestaurantes = [];
      querySnapshot.forEach((docSnap) => {
        loadedRestaurantes.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Filter based on allowedRestaurantId
      const filtered = loadedRestaurantes.filter(r => allowedRestaurantId === "all" || r.id === allowedRestaurantId);
      
      if (filtered.length === 0) {
        DOM.adminRestaurantSelect.innerHTML = `<option value="">Sin tiendas disponibles</option>`;
        return;
      }

      filtered.forEach(r => {
        const option = document.createElement("option");
        option.value = r.id;
        option.innerText = r.name;
        DOM.adminRestaurantSelect.appendChild(option);
      });

      // Disable select dropdown if locked to single restaurant
      if (allowedRestaurantId !== "all") {
        DOM.adminRestaurantSelect.disabled = true;
      } else {
        DOM.adminRestaurantSelect.disabled = false;
      }

      // Select first option by default
      DOM.adminRestaurantSelect.value = filtered[0].id;
      currentRestaurantId = filtered[0].id;
      
      onRestaurantChanged();
    } catch (err) {
      console.error("Error loading restaurants:", err);
    }
  } else {
    // Local fallback list
    const mockRestaurants = [
      { id: "burger-shack", name: "Burger Shack" },
      { id: "pizza-napolitana", name: "Pizza Napolitana" },
      { id: "sushi-zen", name: "Sushi Zen" }
    ];
    
    DOM.adminRestaurantSelect.innerHTML = "";
    const filtered = mockRestaurants.filter(r => allowedRestaurantId === "all" || r.id === allowedRestaurantId);
    
    filtered.forEach(r => {
      const option = document.createElement("option");
      option.value = r.id;
      option.innerText = r.name;
      DOM.adminRestaurantSelect.appendChild(option);
    });

    if (allowedRestaurantId !== "all") {
      DOM.adminRestaurantSelect.disabled = true;
    } else {
      DOM.adminRestaurantSelect.disabled = false;
    }

    DOM.adminRestaurantSelect.value = filtered[0].id;
    currentRestaurantId = filtered[0].id;
    
    onRestaurantChanged();
  }
}

// Fired when active restaurant changes
function onRestaurantChanged() {
  loadRestaurantMetadata();
  loadAdminProducts();
  loadAdminOrders();
}

// Load restaurant metadata into config form fields
async function loadRestaurantMetadata() {
  if (isFirebaseEnabled) {
    try {
      const q = query(collection(db, "restaurantes"));
      onSnapshot(q, (snapshot) => {
        snapshot.forEach((docSnap) => {
          if (docSnap.id === currentRestaurantId) {
            const data = docSnap.data();
            DOM.restName.value = data.name || "";
            DOM.restPhone.value = data.phone || "";
            DOM.restSchedule.value = data.schedule || "";
            DOM.restAddress.value = data.address || "";
            DOM.restLogo.value = data.logo || "";
          }
        });
      });
    } catch (err) {
      console.error("Error loading restaurant metadata:", err);
    }
  } else {
    // Local fallback settings load
    const restData = JSON.parse(localStorage.getItem(`nexus_rest_config_${currentRestaurantId}`)) || {
      name: currentRestaurantId === "burger-shack" ? "Burger Shack" : currentRestaurantId === "pizza-napolitana" ? "Pizza Napolitana" : "Sushi Zen",
      phone: "+54 9 11 1234 5678",
      schedule: "Mar - Dom, 12:00 a 23:00",
      address: "Dirección de demostración",
      logo: ""
    };
    DOM.restName.value = restData.name;
    DOM.restPhone.value = restData.phone;
    DOM.restSchedule.value = restData.schedule;
    DOM.restAddress.value = restData.address;
    DOM.restLogo.value = restData.logo;
  }
}

// Save restaurant metadata
async function handleRestaurantConfigSubmit(e) {
  e.preventDefault();
  
  const name = DOM.restName.value.trim();
  const phone = DOM.restPhone.value.trim();
  const schedule = DOM.restSchedule.value.trim();
  const address = DOM.restAddress.value.trim();
  const logo = DOM.restLogo.value.trim();
  
  const restData = { name, phone, schedule, address, logo };

  if (isFirebaseEnabled) {
    try {
      const docRef = doc(db, "restaurantes", currentRestaurantId);
      await updateDoc(docRef, restData);
      alert("¡Configuración del restaurante guardada con éxito!");
    } catch (err) {
      console.error("Error updating restaurant config:", err);
      alert(`Error al guardar configuración: ${err.message}`);
    }
  } else {
    localStorage.setItem(`nexus_rest_config_${currentRestaurantId}`, JSON.stringify(restData));
    alert("¡Configuración guardada localmente de forma temporal!");
  }
}

// Load products filtered by restaurantId
function loadAdminProducts() {
  if (productsUnsubscribe) {
    productsUnsubscribe();
  }

  if (isFirebaseEnabled) {
    const q = query(collection(db, "productos"), where("restaurantId", "==", currentRestaurantId));
    productsUnsubscribe = onSnapshot(q, (snapshot) => {
      const fbProducts = [];
      snapshot.forEach((doc) => {
        fbProducts.push({ id: doc.id, ...doc.data() });
      });
      products = fbProducts;
      localStorage.setItem(`nexus_products_${currentRestaurantId}`, JSON.stringify(products));
      renderAdminProductsList();
    });
  } else {
    // Local fallback: filter stored products by active restaurantId
    const allProducts = JSON.parse(localStorage.getItem("nexus_products")) || DEFAULT_PRODUCTS;
    products = allProducts.filter(p => p.restaurantId === currentRestaurantId);
    renderAdminProductsList();
  }
}

// Load orders filtered by restaurantId
function loadAdminOrders() {
  if (ordersUnsubscribe) {
    ordersUnsubscribe();
  }

  if (isFirebaseEnabled) {
    const q = query(collection(db, "pedidos"), where("restaurantId", "==", currentRestaurantId));
    ordersUnsubscribe = onSnapshot(q, (snapshot) => {
      const fbOrders = [];
      snapshot.forEach((doc) => {
        fbOrders.push({ firestoreId: doc.id, ...doc.data() });
      });
      orders = fbOrders;
      localStorage.setItem(`nexus_orders_${currentRestaurantId}`, JSON.stringify(orders));
      renderAdminOrdersList();
    });
  } else {
    // Local fallback
    const allOrders = JSON.parse(localStorage.getItem("nexus_orders")) || [];
    orders = allOrders.filter(o => o.restaurantId === currentRestaurantId);
    renderAdminOrdersList();
  }
}

function renderAdminProductsList() {
  DOM.adminProductsList.innerHTML = "";
  
  if (products.length === 0) {
    DOM.adminProductsList.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay productos en este restaurante.</td></tr>`;
    return;
  }
  
  products.forEach(p => {
    const tr = document.createElement("tr");
    const imgUrl = p.img || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80";
    
    tr.innerHTML = `
      <td><img src="${imgUrl}" alt="${p.name}" class="admin-table-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80'"></td>
      <td style="font-weight:600; color:var(--text-main);">${p.name}</td>
      <td><span class="status-badge status-badge-preparing" style="margin-bottom:0; font-size:0.68rem;">${p.category}</span></td>
      <td style="font-family:var(--font-mono); font-weight:700; color:var(--color-success);">$${p.price.toFixed(2)}</td>
      <td style="max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.78rem;">${p.desc || ''}</td>
      <td>
        <div class="admin-actions">
          <button class="secondary-btn btn-icon-only edit-prod-btn" data-id="${p.id}" title="Editar"><i class="bx bx-edit"></i></button>
          <button class="danger-btn btn-icon-only del-prod-btn" data-id="${p.id}" title="Eliminar"><i class="bx bx-trash"></i></button>
        </div>
      </td>
    `;
    
    tr.querySelector(".edit-prod-btn").addEventListener("click", () => openProductFormModal(p.id));
    tr.querySelector(".del-prod-btn").addEventListener("click", () => deleteProduct(p.id));
    
    DOM.adminProductsList.appendChild(tr);
  });
}

function renderAdminOrdersList() {
  DOM.adminOrdersList.innerHTML = "";
  
  const pendingCount = orders.filter(o => o.status === "pendiente" || o.status === "preparando").length;
  DOM.adminPendingBadge.innerText = pendingCount;
  DOM.adminPendingBadge.style.display = pendingCount > 0 ? "inline-block" : "none";
  
  if (orders.length === 0) {
    DOM.adminOrdersList.innerHTML = `<div class="no-data-msg">No se han registrado pedidos en esta tienda.</div>`;
    return;
  }
  
  // Sort reverse chronological
  const sorted = [...orders].sort((a, b) => b.id.localeCompare(a.id));
  
  sorted.forEach(o => {
    const card = document.createElement("div");
    card.className = `order-admin-card status-${o.status}`;
    
    const itemsListHTML = o.items.map(i => `<li>${i.qty}x ${i.name} ($${(i.price * i.qty).toFixed(2)})</li>`).join("");
    
    card.innerHTML = `
      <div class="order-info-col">
        <h3>Pedido #${o.id.replace("NEX-","")}</h3>
        <p><strong>Cliente:</strong> ${o.customer}</p>
        <p><strong>Teléfono:</strong> ${o.phone}</p>
        <p><strong>Hora:</strong> ${o.time}</p>
        <span class="status-badge status-badge-${o.status}">${o.status}</span>
      </div>
      <div class="order-items-col">
        <p style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">Productos:</p>
        <ul>
          ${itemsListHTML}
        </ul>
      </div>
      <div class="order-price-col">
        <div class="order-price-total">$${o.total.toFixed(2)}</div>
        <p>${o.address}</p>
      </div>
      <div class="order-actions-col">
        ${renderOrderAdminActions(o)}
      </div>
    `;
    
    DOM.adminOrdersList.appendChild(card);
  });
}

function renderOrderAdminActions(order) {
  const refId = order.firestoreId || order.id;
  
  if (order.status === "pendiente") {
    return `<button class="primary-btn btn-sm btn-accept" data-ref-id="${refId}" data-next-status="preparando">Aceptar y Preparar</button>`;
  } else if (order.status === "preparando") {
    return `<button class="primary-btn btn-sm btn-ship" style="background:var(--color-info);" data-ref-id="${refId}" data-next-status="transit">Despachar Repartidor</button>`;
  } else if (order.status === "transit") {
    return `<button class="secondary-btn btn-sm btn-complete" data-ref-id="${refId}" data-next-status="completed"><i class="bx bx-check"></i> Entregado</button>`;
  } else {
    return `<span style="font-size:0.75rem; color:var(--color-success); font-weight:700;"><i class="bx bx-check-circle"></i> Pedido Completado</span>`;
  }
}

async function advanceOrderStatus(refId, nextStatus) {
  if (isFirebaseEnabled) {
    try {
      const orderRef = doc(db, "pedidos", refId);
      await updateDoc(orderRef, { status: nextStatus });
    } catch (e) {
      console.error("Error updating order in Firebase:", e);
    }
  } else {
    // Local fallback
    const allOrders = JSON.parse(localStorage.getItem("nexus_orders")) || [];
    const order = allOrders.find(o => o.id === refId);
    if (order) {
      order.status = nextStatus;
      localStorage.setItem("nexus_orders", JSON.stringify(allOrders));
      loadAdminOrders();
    }
  }
}

// --- PRODUCT FORM OPERATIONS ---
function openProductFormModal(productId = null) {
  if (productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    
    DOM.productModalTitle.innerText = "Editar Producto";
    DOM.prodId.value = prod.id;
    DOM.prodName.value = prod.name;
    DOM.prodCategory.value = prod.category;
    DOM.prodPrice.value = prod.price;
    DOM.prodImg.value = prod.img || "";
    DOM.prodDesc.value = prod.desc || "";
  } else {
    DOM.productModalTitle.innerText = "Agregar Nuevo Producto";
    DOM.productForm.reset();
    DOM.prodId.value = "";
  }
  DOM.modalProductForm.classList.add("active");
}

async function handleProductFormSubmit(e) {
  e.preventDefault();
  
  const id = DOM.prodId.value;
  const name = DOM.prodName.value.trim();
  const category = DOM.prodCategory.value;
  const price = parseFloat(DOM.prodPrice.value);
  const img = DOM.prodImg.value.trim();
  const desc = DOM.prodDesc.value.trim();
  
  const productData = { 
    name, 
    category, 
    price, 
    img, 
    desc,
    restaurantId: currentRestaurantId // Associate automatically to active restaurant
  };
  
  if (isFirebaseEnabled) {
    try {
      if (id) {
        const docRef = doc(db, "productos", id);
        await updateDoc(docRef, productData);
      } else {
        await addDoc(collection(db, "productos"), productData);
      }
    } catch (e) {
      console.error("Error saving product to Firebase:", e);
      alert(`Error al guardar producto: ${e.message}`);
    }
  } else {
    // Local fallback
    const allProducts = JSON.parse(localStorage.getItem("nexus_products")) || DEFAULT_PRODUCTS;
    if (id) {
      const index = allProducts.findIndex(p => p.id === id);
      if (index !== -1) {
        allProducts[index] = { id, ...productData };
      }
    } else {
      const newId = "prod-" + Date.now();
      allProducts.push({ id: newId, ...productData });
    }
    localStorage.setItem("nexus_products", JSON.stringify(allProducts));
    loadAdminProducts();
  }
  
  DOM.modalProductForm.classList.remove("active");
}

async function deleteProduct(productId) {
  if (!confirm("¿Estás seguro de que deseas eliminar este producto?")) return;
  
  if (isFirebaseEnabled) {
    try {
      const docRef = doc(db, "productos", productId);
      await deleteDoc(docRef);
    } catch (e) {
      console.error("Error deleting from Firebase:", e);
      alert(`Error al eliminar: ${e.message}`);
    }
  } else {
    // Local fallback
    let allProducts = JSON.parse(localStorage.getItem("nexus_products")) || DEFAULT_PRODUCTS;
    allProducts = allProducts.filter(p => p.id !== productId);
    localStorage.setItem("nexus_products", JSON.stringify(allProducts));
    loadAdminProducts();
  }
}

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
  DOM.btnAddProduct.addEventListener("click", () => openProductFormModal());
  
  const closeModal = () => DOM.modalProductForm.classList.remove("active");
  DOM.btnCloseProductModal.addEventListener("click", closeModal);
  DOM.btnCancelProductModal.addEventListener("click", closeModal);
  DOM.productForm.addEventListener("submit", handleProductFormSubmit);
  
  // Restaurant config submission
  DOM.formRestaurantConfig.addEventListener("submit", handleRestaurantConfigSubmit);

  // Dropdown change listener
  DOM.adminRestaurantSelect.addEventListener("change", (e) => {
    currentRestaurantId = e.target.value;
    onRestaurantChanged();
  });

  DOM.adminTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      DOM.adminTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const target = tab.dataset.adminPanel;
      DOM.adminSubpanels.forEach(p => p.classList.remove("active"));
      document.getElementById(target).classList.add("active");
    });
  });
  
  DOM.btnClearOrders.addEventListener("click", async () => {
    if (!confirm("¿Deseas limpiar todo el historial de pedidos de este restaurante?")) return;
    
    if (isFirebaseEnabled) {
      alert("En Firebase, los registros deben borrarse individualmente desde la consola por seguridad.");
    } else {
      // Local fallback
      let allOrders = JSON.parse(localStorage.getItem("nexus_orders")) || [];
      allOrders = allOrders.filter(o => o.restaurantId !== currentRestaurantId);
      localStorage.setItem("nexus_orders", JSON.stringify(allOrders));
      loadAdminOrders();
    }
  });
  
  // Delegated events for dynamic buttons inside orders grid
  DOM.adminOrdersList.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    
    const refId = button.dataset.refId;
    const nextStatus = button.dataset.nextStatus;
    advanceOrderStatus(refId, nextStatus);
  });
}
