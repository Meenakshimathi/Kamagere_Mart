/* =========================================================
   KAMAGERE MART - MAIN FRONTEND
   Single cart source of truth: localStorage key "km_cart"
   Cart format: { "1": 2, "3": 1 }
========================================================= */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const CART_KEY = "km_cart";
const BUY_NOW_KEY = "km_buy_now";
const USER_KEY = "km_user";
const ADDRESS_KEY = "km_address";
const ORDERS_KEY = "km_orders";

function readCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
        return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch {
        return {};
    }
}

function migrateOldProductCart() {
    // Older product.js used "kamagereCart" as an array.
    // Convert it once so existing test data is not lost.
    try {
        const old = JSON.parse(localStorage.getItem("kamagereCart") || "null");
        if (Array.isArray(old) && old.length) {
            const cart = readCart();
            old.forEach(item => {
                const id = String(item.id);
                cart[id] = Number(item.quantity || 1);
            });
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
            localStorage.removeItem("kamagereCart");
        }
    } catch {
        // Ignore malformed legacy data.
    }
}

migrateOldProductCart();

const state = {
    cart: readCart(),
    user: JSON.parse(localStorage.getItem(USER_KEY) || "null"),
    address: localStorage.getItem(ADDRESS_KEY) || "",
    orders: [],   // loaded from the server
    category: "All",
    query: new URLSearchParams(location.search).get("search") || ""
};

const path = location.pathname;
const page = path.includes("/pages/")
    ? path.split("/").pop().replace(".html", "")
    : "home";
const base = path.includes("/pages/") ? "../" : "";

function save() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    KM.pushCart(state.cart);   // keep server cart in sync when logged in
    localStorage.setItem(ADDRESS_KEY, state.address);

    if (state.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(state.user));
    } else {
        localStorage.removeItem(USER_KEY);
    }
}

function cartCount() {
    return Object.values(state.cart).reduce((sum, qty) => sum + Number(qty || 0), 0);
}

function cartItems() {
    return PRODUCTS
        .filter(product => Number(state.cart[product.id] || 0) > 0)
        .map(product => ({
            ...product,
            qty: Number(state.cart[product.id])
        }));
}

function subtotal() {
    return cartItems().reduce((sum, product) => {
        return sum + Number(product.price) * Number(product.qty);
    }, 0);
}

/* Delivery rule:
   subtotal < ₹199  => ₹25
   subtotal >= ₹199 => FREE
*/
function delivery() {
    const amount = subtotal();
    return amount === 0 ? 0 : amount < 199 ? 25 : 0;
}

function money(value) {
    return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function toast(message) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const element = document.createElement("div");
    element.className = "toast";
    element.textContent = message;
    document.body.appendChild(element);

    setTimeout(() => element.remove(), 2200);
}

function add(id, quantity = 1) {
    const product = PRODUCTS.find(item => Number(item.id) === Number(id));
    if (!product) return;

    const key = String(id);
    state.cart[key] = Number(state.cart[key] || 0) + Number(quantity);
    save();
    render();
    toast(`${product.name} added to cart`);
}

function change(id, delta) {
    const key = String(id);
    state.cart[key] = Number(state.cart[key] || 0) + Number(delta);

    if (state.cart[key] <= 0) {
        delete state.cart[key];
    }

    save();
    render();
}

function nav(active = "") {
    const accountPage = state.user ? "pages/profile.html" : "pages/auth.html";

    return `
        <header class="header">
            <div class="container header-row">
                <a class="logo" href="${base}index.html">
                    <span class="logo-mark">KM</span>
                    <span>Kamagere Mart</span>
                </a>

                <div class="search">
                    <span class="search-icon">⌕</span>
                    <input
                        id="searchInput"
                        type="search"
                        placeholder="Search for atta, milk, snacks..."
                        value="${esc(state.query)}"
                    >
                </div>

                <div class="header-actions">
                    <button class="nav-btn desktop" onclick="location.href='${base}pages/orders.html'">
                        Orders
                    </button>

                    <button class="icon-btn" onclick="location.href='${base}pages/cart.html'" aria-label="Cart">
                        🛒 <span class="badge">${cartCount()}</span>
                    </button>

                    <button class="icon-btn" onclick="location.href='${base}${accountPage}'" aria-label="Profile">
                        👤
                    </button>
                </div>
            </div>
        </header>
    `;
}

function bottom(active) {
    const accountPage = state.user ? "pages/profile.html" : "pages/auth.html";

    return `
        <nav class="bottom-nav">
            <a class="${active === "home" ? "active" : ""}" href="${base}index.html">
                ⌂<span>Home</span>
            </a>
            <a class="${active === "orders" ? "active" : ""}" href="${base}pages/orders.html">
                ▤<span>Orders</span>
            </a>
            <a class="${active === "cart" ? "active" : ""}" href="${base}pages/cart.html">
                🛒<span>Cart${cartCount() ? ` (${cartCount()})` : ""}</span>
            </a>
            <a class="${active === "profile" ? "active" : ""}" href="${base}${accountPage}">
                ●<span>Profile</span>
            </a>
        </nav>
    `;
}

function footer() {
    return `
        <footer class="footer">
            <div class="container footer-grid">
                <div>
                    <h3>Kamagere Mart</h3>
                    <p>Fresh essentials, delivered to your doorstep.</p>
                    <p class="muted">Frontend demo ready for Apps Script / GCP integration.</p>
                </div>
                <div>
                    <h3>Shop</h3>
                    <a href="${base}index.html">Home</a>
                    <a href="${base}pages/cart.html">Cart</a>
                    <a href="${base}pages/orders.html">Orders</a>
                </div>
                <div>
                    <h3>Account</h3>
                    <a href="${base}pages/auth.html">Login / Register</a>
                    <a href="${base}pages/profile.html">Profile</a>
                </div>
            </div>
        </footer>
    `;
}

function productCard(product) {
    return `
        <article class="card product-card-clickable" onclick="openProduct(${product.id})">
            <div class="product-img">
                <span>${product.unit}</span>
                <img
                    src="${base}${product.image}"
                    alt="${product.name}"
                    loading="lazy"
                    onerror="this.style.display='none'"
                >
            </div>

            <div class="card-body">
                <div class="product-name">${product.name}</div>
                <div class="muted">${product.category}</div>

                <div class="price-row">
                    <span class="price">${money(product.price)}</span>
                    <button
                        class="add"
                        onclick="event.stopPropagation(); add(${product.id})"
                        aria-label="Add ${product.name} to cart"
                    >
                        +
                    </button>
                </div>
            </div>
        </article>
    `;
}

function filteredProducts() {
    const query = state.query.toLowerCase().trim();

    return PRODUCTS.filter(product => {
        const categoryMatch = state.category === "All" || product.category === state.category;
        const searchMatch = !query ||
            product.name.toLowerCase().includes(query) ||
            product.category.toLowerCase().includes(query);

        return categoryMatch && searchMatch;
    });
}

function home() {
    return `
        ${nav("home")}
        <main>
            <section class="hero">
                <div class="container hero-grid">
                    <div class="hero-copy">
                        <div class="eyebrow">Kamagere Mart</div>
                        <h1>Daily essentials, right at your doorstep.</h1>
                        <p>Shop groceries, dairy, snacks and household essentials with a simple, mobile-friendly checkout.</p>
                        <div class="location">📍 Delivering to <b>${esc(state.address) || "Set your address"}</b></div>
                        <br>
                        <button class="btn btn-primary" onclick="document.getElementById('products')?.scrollIntoView({behavior:'smooth'})">
                            Shop now →
                        </button>
                    </div>
                    <div class="hero-card">🛍️🥦🥛</div>
                </div>
            </section>

            <section class="section">
                <div class="container">
                    <div class="section-head"><h2>Shop by category</h2></div>
                    <div class="chips">
                        ${CATEGORIES.map(category => `
                            <button
                                class="chip ${state.category === category ? "active" : ""}"
                                onclick="setCategory('${category}')"
                            >
                                ${category}
                            </button>
                        `).join("")}
                    </div>
                </div>
            </section>

            <section class="section" id="products">
                <div class="container">
                    <div class="section-head">
                        <h2>${state.query ? `Search results for "${esc(state.query)}"` : "Popular essentials"}</h2>
                        <span class="muted">${filteredProducts().length} items</span>
                    </div>

                    <div class="grid">
                        ${filteredProducts().map(productCard).join("") || `
                            <div class="empty" style="grid-column:1/-1">
                                <div class="emoji">🔎</div>
                                No products found.
                            </div>
                        `}
                    </div>
                </div>
            </section>

            <section class="section">
                <div class="container">
                    <div class="panel">
                        <b>Delivery information</b>
                        <p class="muted">Orders below ₹199 have a ₹25 delivery charge. Orders of ₹199 or more get free delivery.</p>
                    </div>
                </div>
            </section>
        </main>
        ${footer()}
        ${bottom("home")}
    `;
}

function setCategory(category) {
    state.category = category;
    render();
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
}

function bindSearch() {
    const input = $("#searchInput");
    if (!input) return;

    input.addEventListener("input", event => {
        state.query = event.target.value;
        render();
        const refreshed = $("#searchInput");
        if (refreshed) {
            refreshed.focus();
            refreshed.setSelectionRange(refreshed.value.length, refreshed.value.length);
        }
    });
}

function cartPage() {
    const items = cartItems();
    const currentSubtotal = subtotal();
    const currentDelivery = delivery();
    const total = currentSubtotal + currentDelivery;

    return `
        ${nav("cart")}
        <main class="page">
            <div class="container">
                <h1 class="page-title">Your Cart</h1>

                ${items.length ? `
                    <div class="layout-2">
                        <section class="panel">
                            ${items.map(product => `
                                <div class="cart-item">
                                    <div class="thumb">
                                        <img
                                            src="${base}${product.image}"
                                            alt="${product.name}"
                                            loading="lazy"
                                            onerror="this.src='${base}assets/products/placeholder.jpg'; this.onerror=null;"
                                        >
                                    </div>

                                    <div class="cart-product-info">
                                        <b>${product.name}</b>
                                        <div class="muted">${product.unit}</div>
                                        <div class="qty">
                                            <button onclick="change(${product.id}, -1)" aria-label="Decrease quantity">−</button>
                                            <b>${product.qty}</b>
                                            <button onclick="change(${product.id}, 1)" aria-label="Increase quantity">+</button>
                                        </div>
                                    </div>

                                    <b class="cart-item-price">${money(product.price * product.qty)}</b>
                                </div>
                            `).join("")}
                        </section>

                        <aside class="panel">
                            <h3>Order summary</h3>
                            <div class="summary-row">
                                <span>Subtotal</span>
                                <b>${money(currentSubtotal)}</b>
                            </div>
                            <div class="summary-row">
                                <span>Delivery</span>
                                <b>${currentDelivery ? money(currentDelivery) : "FREE"}</b>
                            </div>
                            <div class="summary-row total">
                                <span>Total</span>
                                <span>${money(total)}</span>
                            </div>
                            <button
                                class="btn btn-primary"
                                style="width:100%;margin-top:14px"
                                onclick="goToCheckout()"
                            >
                                Proceed to Checkout
                            </button>
                        </aside>
                    </div>
                ` : `
                    <div class="panel empty">
                        <div class="emoji">🛒</div>
                        <h2>Your cart is empty</h2>
                        <p>Add some essentials to get started.</p>
                        <a class="btn btn-primary" href="${base}index.html">Continue shopping</a>
                    </div>
                `}
            </div>
        </main>
        ${bottom("cart")}
    `;
}

function getBuyNowItem() {
    try {
        const saved = JSON.parse(localStorage.getItem(BUY_NOW_KEY) || "null");

        if (!saved || typeof saved !== "object") return null;

        const product = PRODUCTS.find(
            item => Number(item.id) === Number(saved.id)
        );

        const qty = Number(saved.qty || 0);

        if (!product || qty <= 0) return null;

        return {
            ...product,
            qty
        };
    } catch {
        return null;
    }
}

function getCheckoutItems() {
    const buyNowItem = getBuyNowItem();

    // If Buy Now was used, checkout contains ONLY that product.
    if (buyNowItem) {
        return [buyNowItem];
    }

    // Normal checkout from Cart.
    return cartItems();
}

function checkoutSubtotal(items) {
    return items.reduce(
        (sum, product) =>
            sum + Number(product.price) * Number(product.qty),
        0
    );
}

function checkoutDelivery(amount) {
    // Below ₹199 => ₹25
    // ₹199 or more => FREE
    if (amount <= 0) return 0;
    return amount < 199 ? 25 : 0;
}

function checkout() {
    const items = getCheckoutItems();

    if (!items.length) {
        return `
            ${nav()}
            <main class="page">
                <div class="container">
                    <div class="panel empty">
                        <div class="emoji">🛒</div>
                        <h2>No items to checkout</h2>
                        <p>Add products to your cart or use Buy Now from a product page.</p>
                        <a class="btn btn-primary" href="${base}index.html">Shop now</a>
                    </div>
                </div>
            </main>
            ${bottom()}
        `;
    }

    const isBuyNow = Boolean(getBuyNowItem());
    const currentSubtotal = checkoutSubtotal(items);
    const currentDelivery = checkoutDelivery(currentSubtotal);
    const total = currentSubtotal + currentDelivery;

    return `
        ${nav()}
        <main class="page">
            <div class="container">
                <h1 class="page-title">Checkout</h1>

                ${
                    isBuyNow
                        ? `
                            <div class="notice" style="margin-bottom:16px">
                                ⚡ Buy Now checkout — only the selected product is included.
                            </div>
                        `
                        : `
                            <div class="notice" style="margin-bottom:16px">
                                🛒 Cart checkout — all products currently in your cart are included.
                            </div>
                        `
                }

                <div class="layout-2">
                    <section class="panel">
                        <h3>Delivery address</h3>

                        <div class="field">
                            <label for="address">Address</label>
                            <textarea
                                id="address"
                                rows="4"
                                placeholder="House/flat, street, area, city, PIN"
                            >${esc(state.address)}</textarea>
                        </div>

                        <br>

                        <button
                            class="btn btn-outline"
                            onclick="useLocation()"
                        >
                            📍 Use my current location
                        </button>

                        <h3 style="margin-top:28px">
                            Payment mode
                        </h3>

                        <label class="payment-option selected">
                            <input
                                type="radio"
                                name="pay"
                                value="COD"
                                checked
                            >
                            Cash on Delivery
                        </label>

                        <label class="payment-option">
                            <input
                                type="radio"
                                name="pay"
                                value="UPI"
                            >
                            UPI
                        </label>

                        <div class="notice">
                            UPI can be connected to a payment gateway / Apps Script backend later.
                        </div>
                    </section>

                    <aside class="panel">
                        <h3>Order summary</h3>

                        ${items.map(product => `
                            <div class="summary-row">
                                <span>
                                    ${product.name} × ${product.qty}
                                </span>

                                <b>
                                    ${money(product.price * product.qty)}
                                </b>
                            </div>
                        `).join("")}

                        <div class="summary-row">
                            <span>Subtotal</span>
                            <b>${money(currentSubtotal)}</b>
                        </div>

                        <div class="summary-row">
                            <span>Delivery</span>
                            <b>
                                ${
                                    currentDelivery
                                        ? money(currentDelivery)
                                        : "FREE"
                                }
                            </b>
                        </div>

                        <div class="summary-row total">
                            <span>Total</span>
                            <span>${money(total)}</span>
                        </div>

                        <button
                            class="btn btn-primary"
                            style="width:100%"
                            onclick="placeOrder()"
                        >
                            Place Order
                        </button>
                    </aside>
                </div>
            </div>
        </main>

        ${bottom()}
    `;
}

function useLocation() {
    if (!navigator.geolocation) {
        toast("Location is not supported by this browser");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            state.address = `GPS: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
            save();
            render();
            toast("Location captured");
        },
        () => toast("Location permission was denied")
    );
}

let placingOrder = false;

async function placeOrder() {
    if (placingOrder) return;

    if (!state.user) {
        toast("Please log in to place your order");
        sessionStorage.setItem("km_after_login", location.href);
        setTimeout(() => { location.href = "auth.html"; }, 900);
        return;
    }

    const address = $("#address")?.value.trim();

    if (!address) {
        toast("Please enter delivery address");
        return;
    }

    const items = getCheckoutItems();

    if (!items.length) {
        toast("No items to checkout");
        return;
    }

    state.address = address;

    const payment = $('input[name="pay"]:checked')?.value || "COD";
    const isBuyNow = Boolean(getBuyNowItem());

    placingOrder = true;

    try {
        // Only ids and quantities are sent. The server looks up prices,
        // checks stock and calculates delivery/total itself.
        const { order } = await KM.api("POST", "/orders", {
            items: items.map(item => ({ id: item.id, qty: item.qty })),
            address,
            payment,
            source: isBuyNow ? "Buy Now" : "Cart"
        });

        /*
         * Buy Now: clear ONLY the temporary Buy Now item; the cart is untouched.
         * Cart checkout: the cart was emptied by the server; mirror that locally.
         */
        if (isBuyNow) {
            localStorage.removeItem(BUY_NOW_KEY);
        } else {
            state.cart = {};
        }

        save();

        toast(payment === "UPI"
            ? `Order ${order.id} placed. UPI payment is pending.`
            : "Order placed successfully");

        setTimeout(() => { location.href = "orders.html"; }, 700);
    } catch (error) {
        if (error.status === 401) {
            KM.clearSession();
            sessionStorage.setItem("km_after_login", location.href);
            toast("Session expired. Please log in again.");
            setTimeout(() => { location.href = "auth.html"; }, 900);
        } else {
            toast(error.message);
        }
        placingOrder = false;
    }
}

async function cancelOrder(code) {
    if (!confirm(`Cancel order #${code}?`)) return;

    try {
        await KM.api("POST", `/orders/${encodeURIComponent(code)}/cancel`);
        const { orders } = await KM.api("GET", "/orders");
        state.orders = orders.map(KM.mapOrder);
        toast("Order cancelled");
        render();
    } catch (error) {
        toast(error.message);
    }
}

function orders() {
    if (!state.user) {
        return `
            ${nav("orders")}
            <main class="page">
                <div class="container">
                    <h1 class="page-title">Orders</h1>
                    <div class="panel empty">
                        <div class="emoji">🔐</div>
                        <h2>Log in to see your orders</h2>
                        <a class="btn btn-primary" href="${base}pages/auth.html">Log in</a>
                    </div>
                </div>
            </main>
            ${bottom("orders")}
        `;
    }

    return `
        ${nav("orders")}
        <main class="page">
            <div class="container">
                <h1 class="page-title">Orders</h1>
                ${state.orders.length ? `
                    <div class="panel">
                        ${state.orders.map(order => `
                            <div class="order">
                                <div>
                                    <b>Order #${esc(order.id)}</b>
                                    <div class="muted">${esc(order.date)} · ${order.items.length} product(s)</div>
                                    <div class="muted">${esc(order.payment)} (${esc(String(order.paymentStatus).replace("_", " ").toLowerCase())}) · ${esc(order.address)}</div>
                                </div>
                                <div style="text-align:right">
                                    <span class="status">${esc(order.status)}</span>
                                    <div style="margin-top:7px;font-weight:800">${money(order.total)}</div>
                                    ${["Confirmed", "Packed"].includes(order.status) ? `
                                        <button class="btn btn-outline" style="margin-top:8px" onclick="cancelOrder('${esc(order.id)}')">Cancel</button>
                                    ` : ""}
                                </div>
                            </div>
                        `).join("")}
                    </div>
                ` : `
                    <div class="panel empty">
                        <div class="emoji">📦</div>
                        <h2>No orders yet</h2>
                        <p>Your placed orders will appear here.</p>
                        <a class="btn btn-primary" href="${base}index.html">Start shopping</a>
                    </div>
                `}
            </div>
        </main>
        ${bottom("orders")}
    `;
}

function profile() {
    if (!state.user) return auth();

    return `
        ${nav("profile")}
        <main class="page">
            <div class="container">
                <h1 class="page-title">Profile</h1>
                <div class="layout-2">
                    <section class="panel">
                        <h3>Account details</h3>
                        <div class="form-grid">
                            <div class="field">
                                <label>Full name</label>
                                <input id="pname" value="${esc(state.user.name)}">
                            </div>
                            <div class="field">
                                <label>Phone</label>
                                <input value="${esc(state.user.phone)}" disabled>
                            </div>
                            <div class="field full">
                                <label>Email</label>
                                <input value="${esc(state.user.email)}" disabled>
                            </div>
                            <div class="field full">
                                <label>Delivery address</label>
                                <textarea id="paddr" rows="3">${esc(state.address)}</textarea>
                            </div>
                        </div>
                        <br>
                        <button class="btn btn-primary" onclick="saveProfile()">Save changes</button>
                    </section>

                    <aside class="panel">
                        <h3>Quick actions</h3>
                        <a class="btn btn-outline" style="width:100%;margin-bottom:10px" href="orders.html">View orders</a>
                        <button class="btn btn-outline" style="width:100%" onclick="logout()">Log out</button>
                    </aside>
                </div>
            </div>
        </main>
        ${bottom("profile")}
    `;
}

async function saveProfile() {
    const name = $("#pname")?.value.trim() || state.user.name;
    const address = $("#paddr")?.value.trim() || "";

    try {
        const { user } = await KM.api("PUT", "/auth/me", { name, address });
        state.user = user;
        state.address = user.address;
        save();
        toast("Profile updated");
        render();
    } catch (error) {
        toast(error.message);
    }
}

function logout() {
    KM.clearSession();
    state.user = null;
    state.cart = {};
    state.orders = [];
    state.address = "";
    location.href = "auth.html";
}

function auth() {
    return `
        ${nav()}
        <main class="auth-wrap">
            <section class="auth">
                <div class="tabs">
                    <button id="loginTab" class="active" onclick="authMode('login')">Log in</button>
                    <button id="registerTab" onclick="authMode('register')">Create account</button>
                </div>
                <div id="authBody"></div>
            </section>
        </main>
        ${bottom()}
    `;
}

function authMode(mode) {
    const body = $("#authBody");
    if (!body) return;

    $("#loginTab")?.classList.toggle("active", mode === "login");
    $("#registerTab")?.classList.toggle("active", mode === "register");

    body.innerHTML = mode === "login"
        ? `
            <h1>Welcome back</h1>
            <p class="muted">Log in to track orders and check out faster.</p>
            <div class="field"><label>Phone number</label><input id="phone" placeholder="10-digit mobile number"></div>
            <br>
            <div class="field"><label>Password</label><input id="password" type="password" placeholder="Password"></div>
            <br>
            <button class="btn btn-primary" style="width:100%" onclick="login()">Log in</button>
        `
        : `
            <h1>Create your account</h1>
            <p class="muted">Create a customer profile for checkout and order tracking.</p>
            <div class="field"><label>Full name</label><input id="rname"></div>
            <br>
            <div class="field"><label>Email</label><input id="remail" type="email"></div>
            <br>
            <div class="field"><label>Phone</label><input id="rphone"></div>
            <br>
            <div class="field"><label>Password</label><input id="rpass" type="password"></div>
            <br>
            <div class="field"><label>Delivery address</label><textarea id="raddr" rows="3"></textarea></div>
            <br>
            <button class="btn btn-primary" style="width:100%" onclick="register()">Create account</button>
        `;
}

async function finishAuth({ token, user }) {
    KM.setToken(token);
    state.user = user;
    if (user.address) state.address = user.address;

    // Merge the guest cart (if any) into the account cart.
    try {
        const { cart } = await KM.api("POST", "/cart/merge", { cart: state.cart });
        state.cart = cart;
    } catch {
        // Keep the local cart if the merge fails.
    }

    save();

    const next = sessionStorage.getItem("km_after_login");
    sessionStorage.removeItem("km_after_login");
    location.href = next || base + "index.html";
}

async function login() {
    const phone = $("#phone")?.value.trim();
    const password = $("#password")?.value;

    if (!phone || !password) return toast("Enter phone number and password");

    try {
        await finishAuth(await KM.api("POST", "/auth/login", { phone, password }));
    } catch (error) {
        toast(error.message);
    }
}

async function register() {
    const name = $("#rname")?.value.trim();
    const email = $("#remail")?.value.trim();
    const phone = $("#rphone")?.value.trim();
    const password = $("#rpass")?.value;
    const address = $("#raddr")?.value.trim() || "";

    if (!name || !email || !phone || !password) {
        return toast("Complete all required fields");
    }

    try {
        await finishAuth(await KM.api("POST", "/auth/register", { name, email, phone, password, address }));
    } catch (error) {
        toast(error.message);
    }
}

function render() {
    const app = $("#app");
    if (!app) return;

    app.innerHTML =
        page === "home" ? home() :
        page === "orders" ? orders() :
        page === "cart" ? cartPage() :
        page === "checkout" ? checkout() :
        page === "profile" ? profile() :
        page === "auth" ? auth() :
        home();

    bindSearch();

    if (page === "auth") {
        authMode("login");
    }
}

function openProduct(id) {
    location.href = `${base}pages/product.html?id=${id}`;
}

function goToCheckout() {
    if (!cartItems().length) {
        toast("Your cart is empty");
        return;
    }

    // Cart checkout must use ONLY the existing cart items.
    // Remove any previous Buy Now session so it cannot leak into Cart checkout.
    localStorage.removeItem(BUY_NOW_KEY);

    location.href = "checkout.html";
}

async function bootstrap() {
    // Load live catalog + refresh session (user, cart) from the backend.
    await KM.bootstrapSession();

    state.cart = readCart();
    state.user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    state.address = localStorage.getItem(ADDRESS_KEY) || "";

    if (page === "orders" && state.user) {
        try {
            const { orders } = await KM.api("GET", "/orders");
            state.orders = orders.map(KM.mapOrder);
        } catch (error) {
            toast(error.message);
        }
    }

    render();
}

bootstrap();
