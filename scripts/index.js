// Загрузка популярных товаров на главную страницу

document.addEventListener('DOMContentLoaded', () => {
    loadPopularProducts();
});

// Кэшируем данные, чтобы не ходить за ними повторно
let popularProductsCache = null;

async function loadProductsData() {
    if (popularProductsCache) return popularProductsCache;
    const resp = await fetch('data/products.json');
    const data = await resp.json();
    popularProductsCache = data;
    return data;
}

async function loadPopularProducts() {
    const products = await loadProductsData();
    const popular = products.slice(0, 4);
    const grid = document.getElementById('popular-products-grid');
    
    if (!grid) return;
    
    grid.innerHTML = '';
    
    popular.forEach(product => {
        const card = createProductCard(product);
        grid.appendChild(card);
    });
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.onclick = () => {
        window.location.href = `product.html?id=${product.id}`;
    };
    
    // Обрезаем описание до 100 символов для карточки
    const shortDescription = product.description 
        ? (product.description.length > 100 
            ? product.description.substring(0, 100) + '...' 
            : product.description)
        : '';
    
    card.innerHTML = `
        <div class="product-image">
            ${product.image || '🚿'}
        </div>
        <div class="product-info">
            <div class="product-name">${product.name}</div>
            ${shortDescription ? `<div class="product-description">${shortDescription}</div>` : ''}
            <div class="product-price">${product.price.toLocaleString('ru-RU')}</div>
        </div>
    `;
    
    return card;
}
