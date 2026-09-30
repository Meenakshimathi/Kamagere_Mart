/* =========================================================
   KAMAGERE MART - API CLIENT
   Talks to the Node backend (backend/). Loaded before app.js / product.js.

   API base URL:
   - Opened via the backend (http://localhost:3000)  -> same origin, "/api"
   - Opened via VS Code Live Server (port 5500 etc.)  -> http://localhost:3000/api
   - Override anytime with: window.KM_API_BASE = "https://api.example.com/api"
========================================================= */
const KM = (() => {
    const TOKEN_KEY = "km_token";

    const sameOrigin =
        location.protocol !== "file:" &&
        (location.port === "3000" ||
            !["localhost", "127.0.0.1"].includes(location.hostname));

    const API_BASE = window.KM_API_BASE ||
        (sameOrigin ? "/api" : "http://localhost:3000/api");

    const token = () => localStorage.getItem(TOKEN_KEY);
    const setToken = value => localStorage.setItem(TOKEN_KEY, value);

    function clearSession() {
        ["km_token", "km_user", "km_cart", "km_address"].forEach(key => localStorage.removeItem(key));
    }

    async function api(method, path, body, options = {}) {
        const headers = { "Content-Type": "application/json" };
        if (token()) headers.Authorization = `Bearer ${token()}`;

        let response;
        try {
            response = await fetch(API_BASE + path, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                keepalive: Boolean(options.keepalive)
            });
        } catch {
            const error = new Error("Cannot reach the server. Is the backend running?");
            error.status = 0;
            throw error;
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) {
            const error = new Error(data.error || `Request failed (${response.status})`);
            error.status = response.status;
            throw error;
        }
        return data;
    }

    /* Replace the static demo data with live catalog data (arrays are mutated in place,
       so existing `PRODUCTS` / `CATEGORIES` references keep working). */
    async function loadCatalog() {
        try {
            const [{ products }, { categories }] = await Promise.all([
                api("GET", "/products"),
                api("GET", "/products/categories")
            ]);
            PRODUCTS.splice(0, PRODUCTS.length, ...products);
            CATEGORIES.splice(0, CATEGORIES.length, ...categories);
        } catch (error) {
            console.warn("Using bundled demo catalog:", error.message);
        }
    }

    /* Catalog + (if logged in) refresh user and cart from the server into localStorage. */
    async function bootstrapSession() {
        await loadCatalog();

        if (!token()) {
            localStorage.removeItem("km_user");
            return null;
        }

        try {
            const { user } = await api("GET", "/auth/me");
            localStorage.setItem("km_user", JSON.stringify(user));
            if (!localStorage.getItem("km_address") && user.address) {
                localStorage.setItem("km_address", user.address);
            }
            const { cart } = await api("GET", "/cart");
            localStorage.setItem("km_cart", JSON.stringify(cart));
            return user;
        } catch (error) {
            if (error.status === 401) clearSession();   // expired / invalid token
            return null;
        }
    }

    /* Fire-and-forget: keep the server copy of the cart in step with localStorage. */
    function pushCart(cart) {
        if (!token()) return;
        api("PUT", "/cart", { cart }, { keepalive: true }).catch(() => {});
    }

    /* Server order -> shape the existing orders page expects. */
    function mapOrder(order) {
        const utc = String(order.date).replace(" ", "T") + "Z";
        return { ...order, date: new Date(utc).toLocaleString("en-IN") };
    }

    return { API_BASE, api, token, setToken, clearSession, loadCatalog, bootstrapSession, pushCart, mapOrder };
})();

/* HTML-escape anything user-controlled before putting it into innerHTML. */
function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
}
