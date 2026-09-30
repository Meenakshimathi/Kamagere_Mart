// ============================================
// KAMAGERE MART - PRODUCT DETAILS PAGE
// ============================================

const productApp = document.getElementById("productApp");


// ============================================
// GET PRODUCT ID FROM URL
// ============================================

const urlParams = new URLSearchParams(window.location.search);

const productId = Number(urlParams.get("id"));


// ============================================
// FIND PRODUCT
// ============================================

// Resolved after the live catalog has loaded (see the bottom of this file).
let product = null;


// ============================================
// IMAGE PATH
// ============================================

function getProductImage(imagePath) {

    if (!imagePath) {
        return "";
    }

    // data.js uses:
    // assets/products/Ashirvaad.jpg

    // product.html is inside /pages/
    // therefore we need:
    // ../assets/products/Ashirvaad.jpg

    if (
        imagePath.startsWith("assets/")
    ) {
        return "../" + imagePath;
    }

    return imagePath;
}


// ============================================
// MONEY FORMAT
// ============================================

function formatPrice(price) {

    return "₹" + Number(price).toLocaleString("en-IN");

}


// ============================================
// PRODUCT QUANTITY
// ============================================

let productQuantityValue = 1;


// ============================================
// RENDER PRODUCT PAGE
// ============================================

function renderProductPage() {

    // Product does not exist

    if (!product) {

        productApp.innerHTML = `

            <header class="product-header">

                <a
                    href="../index.html"
                    class="product-logo"
                >
                    <span class="logo-box">KM</span>

                    <strong>
                        Kamagere Mart
                    </strong>

                </a>

            </header>


            <main class="product-error">

                <div>

                    <h1>
                        Product Not Found
                    </h1>

                    <p>
                        Sorry, this product is not available.
                    </p>

                    <a
                        href="../index.html"
                        class="back-home-button"
                    >
                        ← Continue Shopping
                    </a>

                </div>

            </main>

        `;

        return;
    }


    // ========================================
    // IMAGE
    // ========================================

    const image =
        getProductImage(product.image);


    // ========================================
    // RENDER
    // ========================================

    productApp.innerHTML = `

        <!-- ===================================
             HEADER
        ==================================== -->

        <header class="product-header">

            <div class="product-header-inner">


                <!-- LOGO -->

                <a
                    href="../index.html"
                    class="product-logo"
                >

                    <span class="logo-box">
                        KM
                    </span>

                    <strong>
                        Kamagere Mart
                    </strong>

                </a>


                <!-- SEARCH -->

                <div class="product-search">

                    <span>
                        🔍
                    </span>

                    <input
                        type="text"
                        placeholder="Search for atta, milk, snacks..."
                        id="productSearch"
                    >

                </div>


                <!-- ACTIONS -->

                <div class="product-header-actions">

                    <a
                        href="orders.html"
                        class="header-link"
                    >
                        Orders
                    </a>

                    <a
                        href="cart.html"
                        class="header-cart"
                    >

                        🛒

                        <span id="cartCount">
                            0
                        </span>

                    </a>

                    <a
                        href="profile.html"
                        class="header-profile"
                    >
                        👤
                    </a>

                </div>

            </div>

        </header>


        <!-- ===================================
             MAIN
        ==================================== -->

        <main class="product-main">

            <div class="product-container">


                <!-- BREADCRUMB -->

                <div class="product-breadcrumb">

                    <a href="../index.html">
                        Home
                    </a>

                    <span>›</span>

                    <span>
                        ${product.category}
                    </span>

                    <span>›</span>

                    <strong>
                        ${product.name}
                    </strong>

                </div>


                <!-- =================================
                     PRODUCT
                ================================== -->

                <section class="product-layout">


                    <!-- LEFT IMAGE -->

                    <div class="product-image-section">

                        <div class="product-image-box">

                            <span class="product-unit-badge">
                                ${product.unit}
                            </span>

                            <img
                                src="${image}"
                                alt="${product.name}"
                                class="main-product-image"
                                onerror="this.src='../assets/products/placeholder.jpg'"
                            >

                        </div>

                    </div>


                    <!-- RIGHT DETAILS -->

                    <div class="product-details">


                        <!-- CATEGORY -->

                        <div class="product-category">

                            ${product.category}

                        </div>


                        <!-- NAME -->

                        <h1 class="product-title">

                            ${product.name}

                        </h1>


                        <!-- RATING -->

                        <div class="product-rating">

                            <span class="rating-box">
                                ★ 4.3
                            </span>

                            <span>
                                125 Ratings
                            </span>

                        </div>


                        <!-- PRICE -->

                        <div class="price-area">

                            <span class="current-price">

                                ${formatPrice(product.price)}

                            </span>


                            ${
                                product.oldPrice
                                ?
                                `
                                <span class="old-price">

                                    ${formatPrice(product.oldPrice)}

                                </span>
                                `
                                :
                                ""
                            }


                            ${
                                product.discount
                                ?
                                `
                                <span class="discount">

                                    ${product.discount}% OFF

                                </span>
                                `
                                :
                                ""
                            }

                        </div>


                        <!-- PACK SIZE -->

                        <div class="option-section">

                            <h3>
                                Pack Size
                            </h3>

                            <button
                                class="pack-button active"
                            >
                                ${product.unit}
                            </button>

                        </div>


                        <!-- QUANTITY -->

                        <div class="option-section">

                            <h3>
                                Quantity
                            </h3>

                            <div class="quantity-control">

                                <button
                                    onclick="changeProductQuantity(-1)"
                                >
                                    −
                                </button>

                                <span id="quantityValue">
                                    1
                                </span>

                                <button
                                    onclick="changeProductQuantity(1)"
                                >
                                    +
                                </button>

                            </div>

                        </div>


                        <!-- DELIVERY -->

                        <div class="delivery-card">

                            <div class="delivery-icon">
                                📍
                            </div>

                            <div>

                                <strong>
                                    Delivery available in your area
                                </strong>

                                <p>
                                    Orders below ₹199 have ₹25 delivery.
                                    Orders of ₹199 or more get free delivery.
                                </p>

                            </div>

                        </div>


                        <!-- DESKTOP BUTTONS -->

                        <div class="desktop-product-buttons">

                            <button
                                class="add-cart-button"
                                onclick="addCurrentProductToCart()"
                            >
                                🛒 Add to Cart
                            </button>


                            <button
                                class="buy-now-button"
                                onclick="buyCurrentProduct()"
                            >
                                Buy Now
                            </button>

                        </div>


                        <!-- PRODUCT INFORMATION -->

                        <div class="product-information">

                            <h2>
                                Product Information
                            </h2>

                            <p>

                                ${
                                    product.description ||
                                    "Quality product available at Kamagere Mart for your everyday needs."
                                }

                            </p>

                        </div>


                        <!-- FEATURES -->

                        <div class="product-features">

                            <div>

                                <span>
                                    🚚
                                </span>

                                <strong>
                                    Fast Delivery
                                </strong>

                                <small>
                                    Local delivery
                                </small>

                            </div>


                            <div>

                                <span>
                                    ✓
                                </span>

                                <strong>
                                    Quality Products
                                </strong>

                                <small>
                                    Trusted products
                                </small>

                            </div>


                            <div>

                                <span>
                                    🔄
                                </span>

                                <strong>
                                    Easy Returns
                                </strong>

                                <small>
                                    As per policy
                                </small>

                            </div>

                        </div>

                    </div>

                </section>


                <!-- =================================
                     ABOUT PRODUCT
                ================================== -->

                <section class="about-product">

                    <h2>
                        About this product
                    </h2>

                    <p>

                        ${
                            product.description ||
                            `${product.name} is available at Kamagere Mart.`
                        }

                    </p>

                </section>


            </div>

        </main>


        <!-- ===================================
             MOBILE STICKY BUTTONS
        ==================================== -->

        <div class="mobile-product-buttons">

            <button
                onclick="addCurrentProductToCart()"
            >
                🛒 Add to Cart
            </button>

            <button
                onclick="buyCurrentProduct()"
            >
                Buy Now
            </button>

        </div>

    `;


    updateCartCount();

}


// ============================================
// CHANGE QUANTITY
// ============================================

function changeProductQuantity(change) {

    productQuantityValue += change;


    if (productQuantityValue < 1) {

        productQuantityValue = 1;

    }


    if (productQuantityValue > 20) {

        productQuantityValue = 20;

    }


    const quantityElement =
        document.getElementById("quantityValue");


    if (quantityElement) {

        quantityElement.textContent =
            productQuantityValue;

    }

}


// ============================================
// CART HELPERS
// ============================================

const PRODUCT_CART_KEY = "km_cart";
const PRODUCT_BUY_NOW_KEY = "km_buy_now";

function readProductCart() {
    try {
        const cart = JSON.parse(
            localStorage.getItem(PRODUCT_CART_KEY) || "{}"
        );

        return cart &&
            typeof cart === "object" &&
            !Array.isArray(cart)
            ? cart
            : {};
    } catch {
        return {};
    }
}

function saveProductCart(cart) {
    localStorage.setItem(
        PRODUCT_CART_KEY,
        JSON.stringify(cart)
    );

    // Keep the server cart in sync when logged in.
    KM.pushCart(cart);
}


// ============================================
// ADD TO CART
// ============================================

function addCurrentProductToCart() {

    if (!product) {
        console.error("Product not found");
        return;
    }

    const cart = readProductCart();

    const key = String(product.id);

    cart[key] =
        Number(cart[key] || 0) +
        productQuantityValue;

    saveProductCart(cart);

    /*
     * Add to Cart must NEVER create or modify
     * the Buy Now checkout session.
     */
    updateCartCount();

    alert(
        `${product.name} added to cart successfully!`
    );
}


// ============================================
// BUY NOW
// ============================================

function buyCurrentProduct() {

    if (!product) {
        console.error("Product not found");
        return;
    }

    /*
     * CRITICAL:
     *
     * Buy Now does NOT write to km_cart.
     *
     * It creates a temporary checkout session
     * containing ONLY this product.
     *
     * Existing cart items remain untouched.
     */

    const buyNowData = {
        id: Number(product.id),
        qty: Number(productQuantityValue)
    };

    localStorage.setItem(
        PRODUCT_BUY_NOW_KEY,
        JSON.stringify(buyNowData)
    );

    /*
     * Go directly to checkout.
     *
     * Do NOT use addCurrentProductToCart().
     * Do NOT redirect to cart.html.
     */

    window.location.href = "checkout.html";
}


// ============================================
// CART COUNT
// ============================================

function updateCartCount() {

    const cart = readProductCart();

    const total =
        Object.values(cart).reduce(
            (sum, quantity) =>
                sum + Number(quantity || 0),
            0
        );

    const countElement =
        document.getElementById("cartCount");

    if (countElement) {
        countElement.textContent = total;
    }
}

// ============================================
// SEARCH
// ============================================

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Enter" &&
            document.activeElement?.id ===
            "productSearch"
        ) {

            const searchValue =
                document
                    .getElementById("productSearch")
                    .value
                    .trim();


            if (searchValue) {

                window.location.href =
                    `../index.html?search=${encodeURIComponent(searchValue)}`;

            }

        }

    }
);


// ============================================
// START
// ============================================

KM.bootstrapSession().finally(() => {
    product = PRODUCTS.find(item => item.id === productId) || null;
    renderProductPage();
});
