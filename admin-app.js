/* ==========================================
   NEXUS AI - ADMIN APP LOGIC
   Supports Role-Based Access Control, Multi-Business Management,
   Self-Registration, and Promo CRUD
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
let products = [];
let orders = [];
let promos = [];

let currentRestaurantId = "";
let userRole = "";
let allowedRestaurantId = ""; // "all" or specific business ID
let productsUnsubscribe = null;
let ordersUnsubscribe = null;
let promosUnsubscribe = null;

// --- DOM ELEMENTS REFERENCE ---
const DOM = {
  adminTabs: document.querySelectorAll(".admin-tab"),
  adminSubpanels: document.querySelectorAll(".admin-subpanel"),
  adminProductsList: document.getElementById("admin-products-list"),
  adminOrdersList: document.getElementById("admin-orders-list"),
  adminPendingBadge: document.getElementById("admin-pending-badge"),
  btnAddProduct: document.getElementById("btn-add-product"),
  btnClearOrders: document.getElementById("btn-clear-orders"),

  // Multi-Restaurant Selector
  adminRestaurantSelect: document.getElementById("admin-restaurant-select"),
  
  // Restaurant Config Form (extended)
  formRestaurantConfig: document.getElementById("form-restaurant-config"),
  restName: document.getElementById("rest-name"),
  restDesc: document.getElementById("rest-desc"),
  restPhone: document.getElementById("rest-phone"),
  restSchedule: document.getElementById("rest-schedule"),
  restAddress: document.getElementById("rest-address"),
  restMinDelivery: document.getElementById("rest-min-delivery"),
  restPayCash: document.getElementById("rest-pay-cash"),
  restPayCard: document.getElementById("rest-pay-card"),
  restPayTransfer: document.getElementById("rest-pay-transfer"),
  restLogo: document.getElementById("rest-logo"),

  // Login / Registration Modal
  modalLogin: document.getElementById("modal-login"),
  formLogin: document.getElementById("form-login"),
  formRegister: document.getElementById("form-register"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password"),
  loginErrorMsg: document.getElementById("login-error-msg"),
  btnToggleLoginPass: document.getElementById("btn-toggle-login-pass"),
  tabBtnLogin: document.getElementById("tab-btn-login"),
  tabBtnRegister: document.getElementById("tab-btn-register"),
  regOwnerName: document.getElementById("reg-owner-name"),
  regOwnerEmail: document.getElementById("reg-owner-email"),
  regOwnerPhone: document.getElementById("reg-owner-phone"),
  regOwnerPassword: document.getElementById("reg-owner-password"),
  btnToggleRegPass: document.getElementById("btn-toggle-reg-pass"),
  regBizName: document.getElementById("reg-biz-name"),
  regBizDesc: document.getElementById("reg-biz-desc"),
  regBizSchedule: document.getElementById("reg-biz-schedule"),
  regBizMinDelivery: document.getElementById("reg-biz-min-delivery"),
  regBizAddress: document.getElementById("reg-biz-address"),
  registerErrorMsg: document.getElementById("register-error-msg"),

  // Product Form Modal
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
  prodDesc: document.getElementById("prod-desc"),

  // Promo Panel & Modal
  adminPromosList: document.getElementById("admin-promos-list"),
  btnAddPromo: document.getElementById("btn-add-promo"),
  modalPromoForm: document.getElementById("modal-promo-form"),
  promoForm: document.getElementById("form-promo"),
  promoModalTitle: document.getElementById("promo-modal-title"),
  btnClosePromoModal: document.getElementById("btn-close-promo-modal"),
  btnCancelPromoModal: document.getElementById("btn-cancel-promo-modal"),
  promoId: document.getElementById("promo-id"),
  promoTitle: document.getElementById("promo-title"),
  promoValue: document.getElementById("promo-value"),
  promoActive: document.getElementById("promo-active"),
  promoDesc: document.getElementById("promo-desc"),
  promoImg: document.getElementById("promo-img"),
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  setupLoginAndRegisterHandlers();
});

// ============================================================
// LOGIN & REGISTRATION HANDLERS
// ============================================================
function setupLoginAndRegisterHandlers() {
  // Toggle between login/register tabs
  DOM.tabBtnLogin.addEventListener("click", () => {
    DOM.tabBtnLogin.classList.add("active");
    DOM.tabBtnRegister.classList.remove("active");
    DOM.formLogin.style.display = "block";
    DOM.formRegister.style.display = "none";
    DOM.loginErrorMsg.style.display = "none";
  });

  DOM.tabBtnRegister.addEventListener("click", () => {
    DOM.tabBtnRegister.classList.add("active");
    DOM.tabBtnLogin.classList.remove("active");
    DOM.formRegister.style.display = "block";
    DOM.formLogin.style.display = "none";
    DOM.registerErrorMsg.style.display = "none";
  });

  // Toggle password visibility for login form
  if (DOM.btnToggleLoginPass) {
    DOM.btnToggleLoginPass.addEventListener("click", () => {
      if (DOM.loginPassword.type === "password") {
        DOM.loginPassword.type = "text";
        DOM.btnToggleLoginPass.innerHTML = `<i class="bx bx-hide"></i>`;
      } else {
        DOM.loginPassword.type = "password";
        DOM.btnToggleLoginPass.innerHTML = `<i class="bx bx-show"></i>`;
      }
    });
  }

  // Toggle password visibility for registration form
  if (DOM.btnToggleRegPass) {
    DOM.btnToggleRegPass.addEventListener("click", () => {
      if (DOM.regOwnerPassword.type === "password") {
        DOM.regOwnerPassword.type = "text";
        DOM.btnToggleRegPass.innerHTML = `<i class="bx bx-hide"></i>`;
      } else {
        DOM.regOwnerPassword.type = "password";
        DOM.btnToggleRegPass.innerHTML = `<i class="bx bx-show"></i>`;
      }
    });
  }

  // Login form submit
  DOM.formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = DOM.loginEmail.value.trim().toLowerCase();
    const passwordInput = DOM.loginPassword.value.trim();
    DOM.loginErrorMsg.style.display = "none";

    if (!email || !passwordInput) return;

    if (isFirebaseEnabled) {
      try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          showLoginError("Acceso denegado. El correo no está registrado como administrador.");
          return;
        }

        let isAuthorized = false;
        let correctPassword = false;
        querySnapshot.forEach((docSnap) => {
          const u = docSnap.data();
          if (u.role === "admin" || u.role === "owner") {
            // Check password (allows empty password check for pre-existing seed users)
            if (!u.password || u.password === passwordInput) {
              isAuthorized = true;
              correctPassword = true;
              userRole = u.role;
              allowedRestaurantId = u.restaurantId || "all";
            }
          }
        });

        if (isAuthorized) {
          DOM.modalLogin.classList.remove("active");
          startAdminConsole();
        } else {
          if (!correctPassword) {
            showLoginError("Contraseña incorrecta. Inténtalo de nuevo.");
          } else {
            showLoginError("Acceso denegado. Este correo no tiene rol de administrador.");
          }
        }
      } catch (err) {
        console.error("Firebase Auth Error:", err);
        showLoginError(`Error al verificar credenciales: ${err.message}`);
      }
    } else {
      // Local fallback
      if (email === "searmoco@gmail.com" && passwordInput === "admin123") {
        userRole = "admin";
        allowedRestaurantId = "all";
        DOM.modalLogin.classList.remove("active");
        startAdminConsole();
      } else if (email === "jicr1200@gmail.com" && passwordInput === "owner123") {
        userRole = "owner";
        allowedRestaurantId = "burger-shack";
        DOM.modalLogin.classList.remove("active");
        startAdminConsole();
      } else {
        // Check localStorage users
        const localUsers = JSON.parse(localStorage.getItem("nexus_local_users")) || [];
        const found = localUsers.find(u => u.email === email);
        if (found && found.password === passwordInput) {
          userRole = found.role;
          allowedRestaurantId = found.restaurantId || "all";
          DOM.modalLogin.classList.remove("active");
          startAdminConsole();
        } else {
          showLoginError("Acceso denegado. Contraseña incorrecta o correo no registrado localmente.");
        }
      }
    }
  });

  // Registration form submit
  DOM.formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    DOM.registerErrorMsg.style.display = "none";

    const ownerName = DOM.regOwnerName.value.trim();
    const ownerEmail = DOM.regOwnerEmail.value.trim().toLowerCase();
    const ownerPhone = DOM.regOwnerPhone.value.trim();
    const ownerPassword = DOM.regOwnerPassword.value.trim();
    const bizName = DOM.regBizName.value.trim();
    const bizDesc = DOM.regBizDesc.value.trim();
    const bizSchedule = DOM.regBizSchedule.value.trim();
    const bizMinDelivery = parseFloat(DOM.regBizMinDelivery.value) || 0;
    const bizAddress = DOM.regBizAddress.value.trim();

    // Collect checked payment methods
    const payCheckboxes = document.querySelectorAll("input[name='reg-pay-method']:checked");
    const paymentMethod = Array.from(payCheckboxes).map(c => c.value).join(", ") || "Efectivo";

    if (!ownerName || !ownerEmail || !ownerPassword || !bizName || !bizDesc || !bizSchedule || !bizAddress) {
      showRegisterError("Por favor completa todos los campos obligatorios.");
      return;
    }

    // Generate a URL-friendly business ID from its name
    const bizId = bizName
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const businessData = {
      name: bizName,
      description: bizDesc,
      phone: ownerPhone,
      schedule: bizSchedule,
      address: bizAddress,
      minDeliveryAmount: bizMinDelivery.toFixed(2),
      paymentMethod: paymentMethod,
      logoUrl: "",
      ownerId: ownerEmail,
      createdAt: Date.now()
    };

    const userData = {
      name: ownerName,
      email: ownerEmail,
      phone: ownerPhone,
      password: ownerPassword,
      role: "owner",
      restaurantId: bizId,
      createdAt: Date.now()
    };

    if (isFirebaseEnabled) {
      try {
        // Check if email already exists
        const existingUser = await getDocs(query(collection(db, "users"), where("email", "==", ownerEmail)));
        if (!existingUser.empty) {
          showRegisterError("Este correo ya está registrado. Ingresa desde la pestaña Iniciar Sesión.");
          return;
        }

        // Check if bizId already exists
        const existingBiz = await getDocs(query(collection(db, "businesses")));
        let bizExists = false;
        existingBiz.forEach(d => { if (d.id === bizId) bizExists = true; });
        if (bizExists) {
          showRegisterError(`El nombre de negocio "${bizName}" ya existe. Elige un nombre diferente.`);
          return;
        }

        // Write to Firestore
        await setDoc(doc(db, "businesses", bizId), businessData);
        await addDoc(collection(db, "users"), userData);

        // Auto-login after registration
        userRole = "owner";
        allowedRestaurantId = bizId;
        DOM.modalLogin.classList.remove("active");
        startAdminConsole();

      } catch (err) {
        console.error("Error registering business:", err);
        showRegisterError(`Error al registrar: ${err.message}`);
      }
    } else {
      // Local fallback – save to localStorage
      const allBiz = JSON.parse(localStorage.getItem("nexus_businesses")) || {};
      if (allBiz[bizId]) {
        showRegisterError(`El nombre de negocio "${bizName}" ya existe localmente.`);
        return;
      }
      allBiz[bizId] = businessData;
      localStorage.setItem("nexus_businesses", JSON.stringify(allBiz));

      const localUsers = JSON.parse(localStorage.getItem("nexus_local_users")) || [];
      localUsers.push(userData);
      localStorage.setItem("nexus_local_users", JSON.stringify(localUsers));

      userRole = "owner";
      allowedRestaurantId = bizId;
      DOM.modalLogin.classList.remove("active");
      startAdminConsole();
    }
  });
}

function showLoginError(msg) {
  DOM.loginErrorMsg.innerText = msg;
  DOM.loginErrorMsg.style.display = "block";
}

function showRegisterError(msg) {
  DOM.registerErrorMsg.innerText = msg;
  DOM.registerErrorMsg.style.display = "block";
}

// ============================================================
// ADMIN CONSOLE BOOT
// ============================================================
function startAdminConsole() {
  setupEventListeners();
  loadRestaurants();
}

// ============================================================
// LOAD BUSINESSES LIST INTO SELECTOR
// ============================================================
async function loadRestaurants() {
  if (isFirebaseEnabled) {
    try {
      const querySnapshot = await getDocs(collection(db, "businesses"));
      DOM.adminRestaurantSelect.innerHTML = "";

      const loaded = [];
      querySnapshot.forEach((docSnap) => {
        loaded.push({ id: docSnap.id, ...docSnap.data() });
      });

      const filtered = loaded.filter(r => allowedRestaurantId === "all" || r.id === allowedRestaurantId);

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

      DOM.adminRestaurantSelect.disabled = allowedRestaurantId !== "all";
      DOM.adminRestaurantSelect.value = filtered[0].id;
      currentRestaurantId = filtered[0].id;
      onRestaurantChanged();
    } catch (err) {
      console.error("Error loading restaurants:", err);
    }
  } else {
    // Local fallback – includes localStorage-saved businesses
    const savedBiz = JSON.parse(localStorage.getItem("nexus_businesses")) || {};
    const mockBiz = { "burger-shack": { name: "Burger Shack" }, "pizza-napolitana": { name: "Pizza Napolitana" } };
    const allBiz = { ...mockBiz, ...savedBiz };

    DOM.adminRestaurantSelect.innerHTML = "";
    const entries = Object.entries(allBiz)
      .map(([id, data]) => ({ id, name: data.name }))
      .filter(r => allowedRestaurantId === "all" || r.id === allowedRestaurantId);

    entries.forEach(r => {
      const option = document.createElement("option");
      option.value = r.id;
      option.innerText = r.name;
      DOM.adminRestaurantSelect.appendChild(option);
    });

    DOM.adminRestaurantSelect.disabled = allowedRestaurantId !== "all";
    DOM.adminRestaurantSelect.value = entries[0]?.id || "";
    currentRestaurantId = entries[0]?.id || "";
    onRestaurantChanged();
  }
}

// ============================================================
// WHEN RESTAURANT CHANGES
// ============================================================
function onRestaurantChanged() {
  loadRestaurantMetadata();
  loadAdminProducts();
  loadAdminOrders();
  loadAdminPromos();
}

// ============================================================
// RESTAURANT METADATA (Load + Save)
// ============================================================
async function loadRestaurantMetadata() {
  if (isFirebaseEnabled) {
    const restRef = doc(db, "businesses", currentRestaurantId);
    onSnapshot(restRef, (docSnap) => {
      if (docSnap.exists()) {
        fillConfigForm(docSnap.data());
      }
    });
  } else {
    const allBiz = JSON.parse(localStorage.getItem("nexus_businesses")) || {};
    const data = allBiz[currentRestaurantId] || {
      name: currentRestaurantId,
      description: "",
      phone: "",
      schedule: "",
      address: "",
      minDeliveryAmount: "0.00",
      paymentMethod: "Efectivo",
      logoUrl: ""
    };
    fillConfigForm(data);
  }
}

function fillConfigForm(data) {
  DOM.restName.value = data.name || "";
  DOM.restDesc.value = data.description || "";
  DOM.restPhone.value = data.phone || "";
  DOM.restSchedule.value = data.schedule || "";
  DOM.restAddress.value = data.address || "";
  DOM.restMinDelivery.value = data.minDeliveryAmount || "0.00";
  DOM.restLogo.value = data.logoUrl || "";

  // Payment checkboxes
  const methods = (data.paymentMethod || "").split(",").map(m => m.trim());
  DOM.restPayCash.checked = methods.includes("Efectivo");
  DOM.restPayCard.checked = methods.includes("Tarjeta");
  DOM.restPayTransfer.checked = methods.includes("Transferencia");
}

async function handleRestaurantConfigSubmit(e) {
  e.preventDefault();

  const payMethods = [];
  if (DOM.restPayCash.checked) payMethods.push("Efectivo");
  if (DOM.restPayCard.checked) payMethods.push("Tarjeta");
  if (DOM.restPayTransfer.checked) payMethods.push("Transferencia");

  const restData = {
    name: DOM.restName.value.trim(),
    description: DOM.restDesc.value.trim(),
    phone: DOM.restPhone.value.trim(),
    schedule: DOM.restSchedule.value.trim(),
    address: DOM.restAddress.value.trim(),
    minDeliveryAmount: parseFloat(DOM.restMinDelivery.value || 0).toFixed(2),
    paymentMethod: payMethods.join(", ") || "Efectivo",
    logoUrl: DOM.restLogo.value.trim()
  };

  if (isFirebaseEnabled) {
    try {
      await updateDoc(doc(db, "businesses", currentRestaurantId), restData);
      alert("¡Configuración del negocio guardada con éxito!");
    } catch (err) {
      console.error("Error updating business config:", err);
      alert(`Error al guardar configuración: ${err.message}`);
    }
  } else {
    const allBiz = JSON.parse(localStorage.getItem("nexus_businesses")) || {};
    allBiz[currentRestaurantId] = { ...allBiz[currentRestaurantId], ...restData };
    localStorage.setItem("nexus_businesses", JSON.stringify(allBiz));
    alert("¡Configuración guardada localmente!");
  }
}

// ============================================================
// PRODUCTS (Load + Render + CRUD)
// ============================================================
function loadAdminProducts() {
  if (productsUnsubscribe) productsUnsubscribe();

  if (isFirebaseEnabled) {
    const q = query(collection(db, "businesses", currentRestaurantId, "products"));
    productsUnsubscribe = onSnapshot(q, (snapshot) => {
      products = [];
      snapshot.forEach((d) => products.push({ id: d.id, ...d.data() }));
      renderAdminProductsList();
    });
  } else {
    const allProducts = JSON.parse(localStorage.getItem("nexus_products")) || [];
    products = allProducts.filter(p => p.restaurantId === currentRestaurantId);
    renderAdminProductsList();
  }
}

function renderAdminProductsList() {
  DOM.adminProductsList.innerHTML = "";

  if (products.length === 0) {
    DOM.adminProductsList.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No hay productos. Agrega el primero.</td></tr>`;
    return;
  }

  products.forEach(p => {
    const tr = document.createElement("tr");
    const imgUrl = p.imageUrl || p.img || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80";
    const descText = p.description || p.desc || "";

    tr.innerHTML = `
      <td><img src="${imgUrl}" alt="${p.name}" class="admin-table-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80'"></td>
      <td style="font-weight:600; color:var(--text-main);">${p.name}</td>
      <td><span class="status-badge status-badge-preparing" style="margin-bottom:0; font-size:0.68rem;">${p.category || 'comida'}</span></td>
      <td style="font-family:var(--font-mono); font-weight:700; color:var(--color-success);">$${parseFloat(p.price).toFixed(2)}</td>
      <td style="max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.78rem;">${descText}</td>
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

function openProductFormModal(productId = null) {
  if (productId) {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    DOM.productModalTitle.innerText = "Editar Producto";
    DOM.prodId.value = prod.id;
    DOM.prodName.value = prod.name;
    DOM.prodCategory.value = prod.category || "comida";
    DOM.prodPrice.value = prod.price;
    DOM.prodImg.value = prod.imageUrl || prod.img || "";
    DOM.prodDesc.value = prod.description || prod.desc || "";
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
  const productData = {
    name: DOM.prodName.value.trim(),
    category: DOM.prodCategory.value,
    price: parseFloat(DOM.prodPrice.value),
    imageUrl: DOM.prodImg.value.trim(),
    description: DOM.prodDesc.value.trim(),
    isAvailable: true,
    updatedAt: Date.now()
  };

  if (isFirebaseEnabled) {
    try {
      if (id) {
        await updateDoc(doc(db, "businesses", currentRestaurantId, "products", id), productData);
      } else {
        await addDoc(collection(db, "businesses", currentRestaurantId, "products"), productData);
      }
    } catch (e) {
      console.error("Error saving product:", e);
      alert(`Error al guardar producto: ${e.message}`);
    }
  } else {
    const allProducts = JSON.parse(localStorage.getItem("nexus_products")) || [];
    if (id) {
      const idx = allProducts.findIndex(p => p.id === id);
      if (idx !== -1) allProducts[idx] = { id, ...productData, restaurantId: currentRestaurantId };
    } else {
      allProducts.push({ id: "prod-" + Date.now(), ...productData, restaurantId: currentRestaurantId });
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
      await deleteDoc(doc(db, "businesses", currentRestaurantId, "products", productId));
    } catch (e) {
      console.error("Error deleting product:", e);
      alert(`Error al eliminar: ${e.message}`);
    }
  } else {
    let allProducts = JSON.parse(localStorage.getItem("nexus_products")) || [];
    allProducts = allProducts.filter(p => p.id !== productId);
    localStorage.setItem("nexus_products", JSON.stringify(allProducts));
    loadAdminProducts();
  }
}

// ============================================================
// ORDERS (Load + Render + Status Updates)
// ============================================================
function loadAdminOrders() {
  if (ordersUnsubscribe) ordersUnsubscribe();

  if (isFirebaseEnabled) {
    const q = query(collection(db, "orders"), where("storeId", "==", currentRestaurantId));
    ordersUnsubscribe = onSnapshot(q, (snapshot) => {
      orders = [];
      snapshot.forEach((d) => orders.push({ firestoreId: d.id, ...d.data() }));
      renderAdminOrdersList();
    });
  } else {
    const allOrders = JSON.parse(localStorage.getItem("nexus_orders")) || [];
    orders = allOrders.filter(o => o.storeId === currentRestaurantId || o.restaurantId === currentRestaurantId);
    renderAdminOrdersList();
  }
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

  const sorted = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  sorted.forEach(o => {
    const card = document.createElement("div");
    card.className = `order-admin-card status-${o.status}`;
    const itemsListHTML = (o.items || []).map(i => `<li>${i.qty}x ${i.name} ($${(i.price * i.qty).toFixed(2)})</li>`).join("");

    card.innerHTML = `
      <div class="order-info-col">
        <h3>Pedido #${(o.id || "???").replace("NEX-", "")}</h3>
        <p><strong>Cliente:</strong> ${o.customer || o.name || "?"}</p>
        <p><strong>Teléfono:</strong> ${o.phone || "?"}</p>
        <p><strong>Hora:</strong> ${o.time || "?"}</p>
        <span class="status-badge status-badge-${o.status}">${o.status}</span>
      </div>
      <div class="order-items-col">
        <p style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">Productos:</p>
        <ul>${itemsListHTML}</ul>
      </div>
      <div class="order-price-col">
        <div class="order-price-total">$${(o.total || 0).toFixed(2)}</div>
        <p>${o.address || "?"}</p>
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
    return `<button class="primary-btn btn-sm" style="background:var(--color-info);" data-ref-id="${refId}" data-next-status="transit">Despachar Repartidor</button>`;
  } else if (order.status === "transit") {
    return `<button class="secondary-btn btn-sm" data-ref-id="${refId}" data-next-status="completed"><i class="bx bx-check"></i> Entregado</button>`;
  }
  return `<span style="font-size:0.75rem; color:var(--color-success); font-weight:700;"><i class="bx bx-check-circle"></i> Completado</span>`;
}

async function advanceOrderStatus(refId, nextStatus) {
  if (isFirebaseEnabled) {
    try {
      await updateDoc(doc(db, "orders", refId), { status: nextStatus });
    } catch (e) {
      console.error("Error updating order status:", e);
    }
  } else {
    const allOrders = JSON.parse(localStorage.getItem("nexus_orders")) || [];
    const order = allOrders.find(o => o.id === refId);
    if (order) {
      order.status = nextStatus;
      localStorage.setItem("nexus_orders", JSON.stringify(allOrders));
      loadAdminOrders();
    }
  }
}

// ============================================================
// PROMOS (Load + Render + CRUD)
// ============================================================
function loadAdminPromos() {
  if (promosUnsubscribe) promosUnsubscribe();

  if (isFirebaseEnabled) {
    const q = query(collection(db, "businesses", currentRestaurantId, "promos"));
    promosUnsubscribe = onSnapshot(q, (snapshot) => {
      promos = [];
      snapshot.forEach((d) => promos.push({ id: d.id, ...d.data() }));
      renderAdminPromosList();
    });
  } else {
    promos = JSON.parse(localStorage.getItem(`nexus_promos_${currentRestaurantId}`)) || [];
    renderAdminPromosList();
  }
}

function renderAdminPromosList() {
  DOM.adminPromosList.innerHTML = "";

  if (promos.length === 0) {
    DOM.adminPromosList.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No hay promociones. Agrega la primera.</td></tr>`;
    return;
  }

  promos.forEach(p => {
    const tr = document.createElement("tr");
    const imgUrl = p.imageUrl || "";
    const statusBadge = p.isActive
      ? `<span class="status-badge status-badge-completed" style="font-size:0.65rem; background:rgba(0,200,80,0.15); border:1px solid var(--color-success); color:var(--color-success);">ACTIVA</span>`
      : `<span class="status-badge status-badge-cancelled" style="font-size:0.65rem; background:rgba(235,94,85,0.15); border:1px solid var(--color-danger); color:var(--color-danger);">INACTIVA</span>`;

    tr.innerHTML = `
      <td>
        ${imgUrl ? `<img src="${imgUrl}" alt="${p.title}" class="admin-table-img" onerror="this.style.display='none'">` : `<i class="bx bx-purchase-tag" style="font-size:1.8rem; color:var(--color-primary);"></i>`}
      </td>
      <td style="font-weight:600; color:var(--text-main);">${p.title}</td>
      <td style="font-family:var(--font-mono); font-weight:700; color:var(--color-primary);">${p.value}</td>
      <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.78rem;">${p.description || ""}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="admin-actions">
          <button class="secondary-btn btn-icon-only edit-promo-btn" data-id="${p.id}" title="Editar"><i class="bx bx-edit"></i></button>
          <button class="danger-btn btn-icon-only del-promo-btn" data-id="${p.id}" title="Eliminar"><i class="bx bx-trash"></i></button>
        </div>
      </td>
    `;

    tr.querySelector(".edit-promo-btn").addEventListener("click", () => openPromoFormModal(p.id));
    tr.querySelector(".del-promo-btn").addEventListener("click", () => deletePromo(p.id));
    DOM.adminPromosList.appendChild(tr);
  });
}

function openPromoFormModal(promoId = null) {
  if (promoId) {
    const promo = promos.find(p => p.id === promoId);
    if (!promo) return;
    DOM.promoModalTitle.innerText = "Editar Promoción";
    DOM.promoId.value = promo.id;
    DOM.promoTitle.value = promo.title;
    DOM.promoValue.value = promo.value;
    DOM.promoActive.checked = promo.isActive !== false;
    DOM.promoDesc.value = promo.description || "";
    DOM.promoImg.value = promo.imageUrl || "";
  } else {
    DOM.promoModalTitle.innerText = "Agregar Promoción";
    DOM.promoForm.reset();
    DOM.promoId.value = "";
    DOM.promoActive.checked = true;
  }
  DOM.modalPromoForm.classList.add("active");
}

async function handlePromoFormSubmit(e) {
  e.preventDefault();

  const id = DOM.promoId.value;
  const promoData = {
    title: DOM.promoTitle.value.trim(),
    value: DOM.promoValue.value.trim(),
    isActive: DOM.promoActive.checked,
    description: DOM.promoDesc.value.trim(),
    imageUrl: DOM.promoImg.value.trim(),
    updatedAt: Date.now()
  };

  if (isFirebaseEnabled) {
    try {
      if (id) {
        await updateDoc(doc(db, "businesses", currentRestaurantId, "promos", id), promoData);
      } else {
        await addDoc(collection(db, "businesses", currentRestaurantId, "promos"), promoData);
      }
    } catch (err) {
      console.error("Error saving promo:", err);
      alert(`Error al guardar promoción: ${err.message}`);
    }
  } else {
    const allPromos = JSON.parse(localStorage.getItem(`nexus_promos_${currentRestaurantId}`)) || [];
    if (id) {
      const idx = allPromos.findIndex(p => p.id === id);
      if (idx !== -1) allPromos[idx] = { id, ...promoData };
    } else {
      allPromos.push({ id: "promo-" + Date.now(), ...promoData });
    }
    localStorage.setItem(`nexus_promos_${currentRestaurantId}`, JSON.stringify(allPromos));
    loadAdminPromos();
  }

  DOM.modalPromoForm.classList.remove("active");
}

async function deletePromo(promoId) {
  if (!confirm("¿Eliminar esta promoción?")) return;

  if (isFirebaseEnabled) {
    try {
      await deleteDoc(doc(db, "businesses", currentRestaurantId, "promos", promoId));
    } catch (err) {
      console.error("Error deleting promo:", err);
      alert(`Error al eliminar: ${err.message}`);
    }
  } else {
    let allPromos = JSON.parse(localStorage.getItem(`nexus_promos_${currentRestaurantId}`)) || [];
    allPromos = allPromos.filter(p => p.id !== promoId);
    localStorage.setItem(`nexus_promos_${currentRestaurantId}`, JSON.stringify(allPromos));
    loadAdminPromos();
  }
}

// ============================================================
// SETUP ALL EVENT LISTENERS
// ============================================================
function setupEventListeners() {
  // Product modal
  DOM.btnAddProduct.addEventListener("click", () => openProductFormModal());
  DOM.btnCloseProductModal.addEventListener("click", () => DOM.modalProductForm.classList.remove("active"));
  DOM.btnCancelProductModal.addEventListener("click", () => DOM.modalProductForm.classList.remove("active"));
  DOM.productForm.addEventListener("submit", handleProductFormSubmit);

  // Promo modal
  DOM.btnAddPromo.addEventListener("click", () => openPromoFormModal());
  DOM.btnClosePromoModal.addEventListener("click", () => DOM.modalPromoForm.classList.remove("active"));
  DOM.btnCancelPromoModal.addEventListener("click", () => DOM.modalPromoForm.classList.remove("active"));
  DOM.promoForm.addEventListener("submit", handlePromoFormSubmit);

  // Restaurant config
  DOM.formRestaurantConfig.addEventListener("submit", handleRestaurantConfigSubmit);

  // Business selector dropdown
  DOM.adminRestaurantSelect.addEventListener("change", (e) => {
    currentRestaurantId = e.target.value;
    onRestaurantChanged();
  });

  // Admin tab navigation
  DOM.adminTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      DOM.adminTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.adminPanel;
      DOM.adminSubpanels.forEach(p => p.classList.remove("active"));
      document.getElementById(target)?.classList.add("active");
    });
  });

  // Clear orders
  DOM.btnClearOrders.addEventListener("click", async () => {
    if (!confirm("¿Deseas limpiar todo el historial de pedidos?")) return;
    if (isFirebaseEnabled) {
      alert("En Firebase, los registros deben borrarse individualmente desde la consola por seguridad.");
    } else {
      let allOrders = JSON.parse(localStorage.getItem("nexus_orders")) || [];
      allOrders = allOrders.filter(o => (o.storeId || o.restaurantId) !== currentRestaurantId);
      localStorage.setItem("nexus_orders", JSON.stringify(allOrders));
      loadAdminOrders();
    }
  });

  // Delegated event for order status buttons inside orders list
  DOM.adminOrdersList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-ref-id]");
    if (!btn) return;
    advanceOrderStatus(btn.dataset.refId, btn.dataset.nextStatus);
  });
}
