// Страница товара

document.addEventListener('DOMContentLoaded', () => {
    loadProduct();
});

let productsCache = null;

async function loadProductsData() {
    if (productsCache) return productsCache;
    const resp = await fetch('data/products.json');
    const data = await resp.json();
    productsCache = data;
    return data;
}

async function loadProduct() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
        showError('Товар не найден');
        return;
    }
    
    const products = await loadProductsData();
    const product = products.find(p => p.id === parseInt(productId, 10));
    
    if (!product) {
        showError('Товар не найден');
        return;
    }
    
    displayProduct(product);
}

function displayProduct(product) {
    const content = document.getElementById('product-content');
    
    if (!content) return;
    
    const specsHtml = product.specs ? Object.entries(product.specs)
        .map(([key, value]) => `
            <div class="spec-item">
                <span class="spec-label">${key}:</span>
                <span class="spec-value">${value}</span>
            </div>
        `).join('') : '';
    
    content.innerHTML = `
        <a href="catalog.html" class="back-link">← Вернуться в каталог</a>
        <div class="product-image-container">
            <div class="product-image-placeholder">
                ${product.image || '🚿'}
            </div>
        </div>
        <div class="product-details">
            <h1>${product.name}</h1>
            <div class="product-price">${product.price.toLocaleString('ru-RU')}</div>
            <div class="product-description">${product.description}</div>
            ${specsHtml ? `
                <div class="product-specs">
                    <h3>Характеристики</h3>
                    ${specsHtml}
                </div>
            ` : ''}
            <a href="#" class="btn-order" id="order-btn">Заказать услугу</a>
        </div>
    `;
    
    // Обработчик кнопки заказа
    const orderBtn = document.getElementById('order-btn');
    if (orderBtn) {
        orderBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Переход в WhatsApp
            window.open('https://wa.me/77072665246', '_blank');
        });
    }
}

function showError(message) {
    const content = document.getElementById('product-content');
    if (content) {
        content.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <h2 style="color: var(--accent-color); margin-bottom: 20px;">${message}</h2>
                <a href="catalog.html" class="btn-primary">Вернуться в каталог</a>
            </div>
        `;
    }
}
