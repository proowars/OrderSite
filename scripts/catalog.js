// Функциональность каталога товаров

document.addEventListener('DOMContentLoaded', async () => {
    await loadAllProducts();
    setupSearch();
});

let productsCache = null;

async function loadProductsData() {
    if (productsCache) return productsCache;
    const resp = await fetch('data/products.json');
    const data = await resp.json();
    productsCache = data;
    return data;
}

async function loadAllProducts() {
    const grid = document.getElementById('products-grid');
    const noResults = document.getElementById('no-results');
    if (!grid) return;
    grid.innerHTML = '';

    try {
        const products = await loadProductsData();
        console.log('Загружено товаров из JSON:', products ? products.length : 0);

        if (!products || products.length === 0) {
            grid.style.display = 'none';
            if (noResults) noResults.style.display = 'block';
            return;
        }

        if (noResults) noResults.style.display = 'none';
        grid.style.display = 'grid';

        products.forEach(product => {
            const card = createProductCard(product);
            grid.appendChild(card);
        });
    } catch (err) {
        console.error('Ошибка загрузки товаров:', err);
        if (noResults) noResults.style.display = 'block';
    }
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

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const grid = document.getElementById('products-grid');
    const noResults = document.getElementById('no-results');
    
    if (!searchInput || !grid) return;
    
    const performSearch = async () => {
        const query = searchInput.value.trim();
        
        if (query === '') {
            await loadAllProducts();
            return;
        }
        
        // Поиск по данным из JSON
        try {
            const products = await loadProductsData();
            const lowerQuery = query.toLowerCase();
            const results = products.filter(product => 
                product.name.toLowerCase().includes(lowerQuery) ||
                product.description.toLowerCase().includes(lowerQuery) ||
                product.category.toLowerCase().includes(lowerQuery)
            );
            grid.innerHTML = '';

            if (!results || results.length === 0) {
                grid.style.display = 'none';
                if (noResults) noResults.style.display = 'block';
                return;
            }

            if (noResults) noResults.style.display = 'none';
            grid.style.display = 'grid';

            results.forEach(product => {
                const card = createProductCard(product);
                grid.appendChild(card);
            });
        } catch (err) {
            console.error('Ошибка поиска:', err);
            if (noResults) noResults.style.display = 'block';
        }
    };
    
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Поиск в реальном времени
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        if (query.length >= 2 || query.length === 0) {
            performSearch();
        }
    });
}
