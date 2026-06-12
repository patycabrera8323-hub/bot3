/* ==========================================
   NEXUS AI - ADMIN APP LOGIC
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
  query
} from './firebase-config.js';

// --- INITIAL STATE ---
const DEFAULT_PRODUCTS = [
  { id: "prod-1", name: "Hamburguesa Double Smash", category: "comida", price: 12.00, img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80", desc: "Doble carne premium (120g c/u), cheddar derretido, cebolla caramelizada, pepinillos y salsa de la casa." },
  { id: "prod-2", name: "Pizza Pepperoni Suprema", category: "comida", price: 14.50, img: "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=500&q=80", desc: "Masa artesanal delgada con salsa napolitana, mozzarella, pepperoni y orégano." }
];

let products = JSON.parse(localStorage.getItem("nexus_products")) || DEFAULT_PRODUCTS;
let orders = JSON.parse(localStorage.getItem("nexus_orders")) || [];

// --- DOM ELEMENTS REFERENCE ---
const DOM = {
  adminTabs: document.querySelectorAll(".admin-tab"),
  adminSubpanels: document.querySelectorAll(".admin-subpanel"),
  adminProductsList: document.getElementById("admin-products-list"),
  adminOrdersList: document.getElementById("admin-orders-list"),
  adminPendingBadge: document.getElementById("admin-pending-badge"),
  btnAddProduct: document.getElementById("btn-add-product"),
  btnClearOrders: document.getElementById("btn-clear-orders"),
  
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
  initAdmin();
});

function initAdmin() {
  setupEventListeners();
  loadAdminProducts();
  loadAdminOrders();
}

// Load products from Firebase or Local
function loadAdminProducts() {
  if (isFirebaseEnabled) {
    const q = query(collection(db, "productos"));
    onSnapshot(q, (snapshot) => {
      const fbProducts = [];
      snapshot.forEach((doc) => {
        fbProducts.push({ id: doc.id, ...doc.data() });
      });
      if (fbProducts.length > 0) {
        products = fbProducts;
        localStorage.setItem("nexus_products", JSON.stringify(products));
      }
      renderAdminProductsList();
    });
  } else {
    renderAdminProductsList();
  }
}

// Load orders from Firebase or Local
function loadAdminOrders() {
  if (isFirebaseEnabled) {
    const q = query(collection(db, "pedidos"));
    onSnapshot(q, (snapshot) => {
      const fbOrders = [];
      snapshot.forEach((doc) => {
        // Use document ID as the internal ID ref
        fbOrders.push({ firestoreId: doc.id, ...doc.data() });
      });
      orders = fbOrders;
      localStorage.setItem("nexus_orders", JSON.stringify(orders));
      renderAdminOrdersList();
    });
  } else {
    renderAdminOrdersList();
  }
}

function renderAdminProductsList() {
  DOM.adminProductsList.innerHTML = "";
  
  if (products.length === 0) {
    DOM.adminProductsList.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay productos en el catálogo.</td></tr>`;
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
    DOM.adminOrdersList.innerHTML = `<div class="no-data-msg">No se han registrado pedidos todavía.</div>`;
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
    const order = orders.find(o => o.id === refId);
    if (order) {
      order.status = nextStatus;
      localStorage.setItem("nexus_orders", JSON.stringify(orders));
      renderAdminOrdersList();
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
  
  const productData = { name, category, price, img, desc };
  
  if (isFirebaseEnabled) {
    try {
      if (id) {
        // Edit document in Firestore
        const docRef = doc(db, "productos", id);
        await updateDoc(docRef, productData);
      } else {
        // Add new document
        await addDoc(collection(db, "productos"), productData);
      }
    } catch (e) {
      console.error("Error saving product to Firebase:", e);
    }
  } else {
    // Local fallback
    if (id) {
      const index = products.findIndex(p => p.id === id);
      if (index !== -1) {
        products[index] = { id, ...productData };
      }
    } else {
      const newId = "prod-" + Date.now();
      products.push({ id: newId, ...productData });
    }
    localStorage.setItem("nexus_products", JSON.stringify(products));
    renderAdminProductsList();
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
    }
  } else {
    products = products.filter(p => p.id !== productId);
    localStorage.setItem("nexus_products", JSON.stringify(products));
    renderAdminProductsList();
  }
}

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
  DOM.btnAddProduct.addEventListener("click", () => openProductFormModal());
  
  const closeModal = () => DOM.modalProductForm.classList.remove("active");
  DOM.btnCloseProductModal.addEventListener("click", closeModal);
  DOM.btnCancelProductModal.addEventListener("click", closeModal);
  DOM.productForm.addEventListener("submit", handleProductFormSubmit);
  
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
    if (!confirm("¿Deseas limpiar todo el historial de pedidos?")) return;
    
    if (isFirebaseEnabled) {
      alert("En Firebase, los registros deben borrarse individualmente desde la consola por seguridad.");
    } else {
      orders = [];
      localStorage.setItem("nexus_orders", JSON.stringify(orders));
      renderAdminOrdersList();
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
