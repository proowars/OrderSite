const API_BASE = '/api/admin/products';
const LOGIN_URL = '/api/admin/login';
const TOKEN_STORAGE_KEY = 'aquatech_admin_token';

let currentToken = null;
let productsCache = [];

document.addEventListener('DOMContentLoaded', () => {
    initAdminPanel();
});

async function initAdminPanel() {
    currentToken = localStorage.getItem(TOKEN_STORAGE_KEY) || null;

    const logoutBtn = document.getElementById('logout-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const form = document.getElementById('product-form');
    const resetBtn = document.getElementById('reset-btn');
    const deleteBtn = document.getElementById('delete-btn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            currentToken = null;
            showToast('Вы вышли из админ-панели');
            promptForToken(true);
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadProducts());
    }

    if (form) {
        form.addEventListener('submit', onFormSubmit);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetForm);
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', onDeleteClick);
    }

    await ensureTokenAndLoad();
}

async function ensureTokenAndLoad() {
    if (!(await validateToken(currentToken))) {
        await promptForToken(false);
    }
    await loadProducts();
}

async function promptForToken(force) {
    let valid = false;
    let attempts = 0;

    while (!valid && attempts < 3) {
        const token = window.prompt(force || attempts > 0
            ? 'Введите пароль администратора:'
            : 'Для входа в админ-панель введите пароль администратора:');

        if (!token) {
            if (!force && attempts === 0) {
                showToast('Пароль не введён, работа админки ограничена', true);
                return;
            }
            attempts++;
            continue;
        }

        const ok = await validateToken(token);
        if (ok) {
            currentToken = token;
            localStorage.setItem(TOKEN_STORAGE_KEY, token);
            showToast('Вход в админ-панель выполнен');
            valid = true;
        } else {
            showToast('Неверный пароль', true);
            attempts++;
        }
    }

    if (!valid) {
        showToast('Не удалось войти в админ-панель', true);
    }
}

async function validateToken(token) {
    if (!token) return false;
    try {
        const resp = await fetch(LOGIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });
        if (!resp.ok) return false;
        const data = await resp.json();
        return !!data.ok;
    } catch (e) {
        console.error('Ошибка при проверке токена:', e);
        return false;
    }
}

async function loadProducts() {
    const list = document.getElementById('products-list');
    if (!list) return;

    list.innerHTML = '<div style="padding: 10px; font-size: 13px; color: var(--muted-color);">Загрузка...</div>';

    try {
        const resp = await fetch(API_BASE, {
            headers: {
                'x-admin-token': currentToken || ''
            }
        });
        if (resp.status === 401) {
            showToast('Нужен вход в админ-панель', true);
            await promptForToken(true);
            return loadProducts();
        }
        if (!resp.ok) {
            throw new Error('Ошибка загрузки товаров');
        }
        const data = await resp.json();
        productsCache = Array.isArray(data) ? data : [];
        renderProductsList(productsCache);
    } catch (e) {
        console.error('Ошибка загрузки товаров:', e);
        list.innerHTML = '<div style="padding: 10px; font-size: 13px; color: var(--muted-color);">Ошибка загрузки товаров</div>';
        showToast('Ошибка загрузки товаров', true);
    }
}

function renderProductsList(products) {
    const list = document.getElementById('products-list');
    if (!list) return;

    if (!products || products.length === 0) {
        list.innerHTML = '<div style="padding: 10px; font-size: 13px; color: var(--muted-color);">Пока нет ни одного товара</div>';
        return;
    }

    const header = document.createElement('div');
    header.className = 'product-row header-row';
    header.innerHTML = `
        <div>ID</div>
        <div>Название</div>
        <div>Категория</div>
        <div>Цена</div>
        <div style="text-align:right;">Действия</div>
    `;

    list.innerHTML = '';
    list.appendChild(header);

    products.forEach(p => {
        const row = document.createElement('div');
        row.className = 'product-row';
        row.innerHTML = `
            <div class="product-id">#${p.id}</div>
            <div class="product-name-cell">${escapeHtml(p.name || '')}</div>
            <div class="product-category-cell">${escapeHtml(p.category || '')}</div>
            <div class="product-price-cell">${formatPrice(p.price)}</div>
            <div class="product-actions">
                <button class="btn-secondary btn-xs" data-action="edit">Редакт.</button>
                <button class="btn-danger btn-xs" data-action="delete">Удалить</button>
            </div>
        `;

        const actions = row.querySelector('.product-actions');
        if (actions) {
            actions.querySelector('[data-action="edit"]').addEventListener('click', () => {
                fillFormForEdit(p);
            });
            actions.querySelector('[data-action="delete"]').addEventListener('click', () => {
                confirmDelete(p);
            });
        }

        list.appendChild(row);
    });
}

function fillFormForEdit(product) {
    const idInput = document.getElementById('product-id');
    const nameInput = document.getElementById('product-name');
    const categoryInput = document.getElementById('product-category');
    const priceInput = document.getElementById('product-price');
    const imageInput = document.getElementById('product-image');
    const descInput = document.getElementById('product-description');
    const specsInput = document.getElementById('product-specs');
    const formTitle = document.getElementById('form-title');
    const deleteBtn = document.getElementById('delete-btn');

    if (!product) return;

    if (formTitle) formTitle.textContent = `Редактирование товара #${product.id}`;
    if (idInput) idInput.value = product.id;
    if (nameInput) nameInput.value = product.name || '';
    if (categoryInput) categoryInput.value = product.category || '';
    if (priceInput) priceInput.value = product.price != null ? String(product.price) : '';
    if (imageInput) imageInput.value = product.image || '';
    if (descInput) descInput.value = product.description || '';
    if (specsInput) specsInput.value = specsObjectToText(product.specs || {});
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
}

function resetForm() {
    const form = document.getElementById('product-form');
    const formTitle = document.getElementById('form-title');
    const deleteBtn = document.getElementById('delete-btn');
    if (form) {
        form.reset();
        const hiddenId = document.getElementById('product-id');
        if (hiddenId) hiddenId.value = '';
    }
    if (formTitle) formTitle.textContent = 'Создать товар';
    if (deleteBtn) deleteBtn.style.display = 'none';
}

async function onFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value.trim();
    const category = document.getElementById('product-category').value.trim();
    const price = document.getElementById('product-price').value.trim();
    const image = document.getElementById('product-image').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const specsText = document.getElementById('product-specs').value;

    if (!name || !category) {
        showToast('Название и категория обязательны', true);
        return;
    }

    const specs = specsTextToObject(specsText);

    const body = {
        name,
        category,
        description,
        image,
        specs
    };

    if (price !== '') {
        body.price = price;
    } else {
        body.price = '';
    }

    try {
        const url = id ? `${API_BASE}/${id}` : API_BASE;
        const method = id ? 'PUT' : 'POST';

        const resp = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': currentToken || ''
            },
            body: JSON.stringify(body)
        });

        if (resp.status === 401) {
            showToast('Нужен вход в админ-панель', true);
            await promptForToken(true);
            return;
        }

        if (!resp.ok) {
            const errData = await safeJson(resp);
            throw new Error(errData && errData.error ? errData.error : 'Ошибка сохранения');
        }

        await resp.json();
        showToast(id ? 'Товар обновлён' : 'Товар создан');
        await loadProducts();
        if (!id) {
            resetForm();
        }
    } catch (e) {
        console.error('Ошибка сохранения:', e);
        showToast(e.message || 'Ошибка сохранения товара', true);
    }
}

function confirmDelete(product) {
    if (!product) return;
    const ok = window.confirm(`Удалить товар "${product.name}" (#${product.id})?`);
    if (!ok) return;
    deleteProduct(product.id);
}

async function onDeleteClick() {
    const id = document.getElementById('product-id').value;
    if (!id) return;

    const product = productsCache.find(p => String(p.id) === String(id));
    confirmDelete(product || { id });
}

async function deleteProduct(id) {
    try {
        const resp = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
            headers: {
                'x-admin-token': currentToken || ''
            }
        });

        if (resp.status === 401) {
            showToast('Нужен вход в админ-панель', true);
            await promptForToken(true);
            return;
        }

        if (!resp.ok) {
            const errData = await safeJson(resp);
            throw new Error(errData && errData.error ? errData.error : 'Ошибка удаления');
        }

        showToast('Товар удалён');
        resetForm();
        await loadProducts();
    } catch (e) {
        console.error('Ошибка удаления:', e);
        showToast(e.message || 'Ошибка удаления товара', true);
    }
}

function specsTextToObject(text) {
    const specs = {};
    if (!text) return specs;
    const lines = text.split('\n');
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const idx = line.indexOf(':');
        if (idx === -1) {
            specs[line] = '';
        } else {
            const key = line.slice(0, idx).trim();
            const value = line.slice(idx + 1).trim();
            if (key) {
                specs[key] = value;
            }
        }
    }
    return specs;
}

function specsObjectToText(obj) {
    if (!obj || typeof obj !== 'object') return '';
    const lines = [];
    for (const [key, value] of Object.entries(obj)) {
        lines.push(`${key}: ${value}`);
    }
    return lines.join('\n');
}

function formatPrice(price) {
    if (price == null || price === '') return '—';
    if (typeof price === 'number') {
        return price.toLocaleString('ru-RU');
    }
    // строка
    return String(price);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function safeJson(resp) {
    try {
        return await resp.json();
    } catch {
        return null;
    }
}

function showToast(message, isError) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show' + (isError ? ' toast-error' : '');
    setTimeout(() => {
        toast.className = 'toast';
    }, 2600);
}


