const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'aquaphorm.db');
const PRODUCTS_JSON_PATH = path.join(DATA_DIR, 'products.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin123'; // простой токен для админки

function seedProducts(db) {
  const products = [
    ['Смеситель для раковины AquaFlow Pro', 'Современный смеситель с сенсорным управлением и функцией экономии воды. Изготовлен из нержавеющей стали высшего качества.', 12500, 'Смесители', '🚿', JSON.stringify({"Материал": "Нержавеющая сталь", "Тип": "Однорычажный", "Управление": "Сенсорное", "Гарантия": "5 лет"})],
    ['Душевая кабина SmartShower 2000', 'Инновационная душевая кабина с системой умного управления температурой и гидромассажем. Встроенная LED подсветка.', 45000, 'Душевые кабины', '🚿', JSON.stringify({"Размеры": "90x90 см", "Материал": "Закаленное стекло", "Функции": "Гидромассаж, LED подсветка", "Гарантия": "3 года"})],
    ['Унитаз подвесной EcoFlush', 'Экологичный подвесной унитаз с системой двойного слива. Экономит до 50% воды по сравнению с обычными моделями.', 28000, 'Унитазы', '🚽', JSON.stringify({"Тип": "Подвесной", "Слив": "Двойной (3/6 литров)", "Материал": "Керамика", "Гарантия": "10 лет"})],
    ['Раковина накладная Crystal', 'Элегантная накладная раковина из искусственного камня. Устойчива к царапинам и пятнам.', 15000, 'Раковины', '🚰', JSON.stringify({"Материал": "Искусственный камень", "Размеры": "60x40 см", "Цвет": "Белый", "Гарантия": "5 лет"})],
    ['Ванна акриловая Comfort 170', 'Просторная акриловая ванна с гидромассажной системой. Вместимость 170 литров, идеальна для релаксации.', 55000, 'Ванны', '🛁', JSON.stringify({"Размеры": "170x70 см", "Материал": "Акрил", "Функции": "Гидромассаж", "Гарантия": "5 лет"})],
    ['Полотенцесушитель электрический Thermo', 'Современный электрический полотенцесушитель с терморегулятором. Безопасен и экономичен.', 8500, 'Полотенцесушители', '🔌', JSON.stringify({"Тип": "Электрический", "Мощность": "200 Вт", "Размеры": "80x50 см", "Гарантия": "2 года"})],
    ['Фильтр для воды AquaPure', 'Многоступенчатый фильтр для очистки воды. Удаляет хлор, тяжелые металлы и бактерии.', 12000, 'Фильтры', '💧', JSON.stringify({"Тип": "Проточный", "Ступени очистки": "5", "Ресурс": "10000 литров", "Гарантия": "1 год"})],
    ['Трубы полипропиленовые AquaPipe', 'Надежные полипропиленовые трубы для водоснабжения. Устойчивы к коррозии и перепадам температур.', 250, 'Трубы', '🔧', JSON.stringify({"Диаметр": "20 мм", "Материал": "Полипропилен", "Длина": "2 метра", "Гарантия": "50 лет"})]
  ];

  const stmt = db.prepare(`INSERT INTO products (name, description, price, category, image, specs) VALUES (?, ?, ?, ?, ?, ?)`);
  products.forEach(p => stmt.run(p));
  stmt.finalize();
}

function initDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        image TEXT,
        specs TEXT
      )
    `);

    db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
      if (err) {
        console.error('Ошибка при проверке количества записей в БД:', err);
        return;
      }
      if (row && row.count === 0) {
        seedProducts(db);
        console.log('Семпл-данные добавлены в БД');
      }
    });
  });

  return db;
}

const db = initDb();

app.use(express.json());
// Статические файлы сайта
app.use(express.static(path.join(__dirname)));

// ===== Работа с товарами в JSON (для админ-панели) =====

function loadProductsFromJson() {
  try {
    if (!fs.existsSync(PRODUCTS_JSON_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(PRODUCTS_JSON_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Ошибка чтения products.json:', err);
    return [];
  }
}

function saveProductsToJson(products) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PRODUCTS_JSON_PATH, JSON.stringify(products, null, 2), 'utf8');
  } catch (err) {
    console.error('Ошибка записи products.json:', err);
    throw err;
  }
}

function adminAuth(req, res, next) {
  const token = req.header('x-admin-token');
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Неавторизовано' });
  }
  next();
}

// Проверка токена (можно использовать для экрана логина)
app.post('/api/admin/login', (req, res) => {
  const { token } = req.body || {};
  if (token === ADMIN_TOKEN) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: 'Неверный пароль' });
});

// Получить все товары (из JSON)
app.get('/api/admin/products', adminAuth, (req, res) => {
  const products = loadProductsFromJson();
  res.json(products);
});

// Создать новый товар
app.post('/api/admin/products', adminAuth, (req, res) => {
  try {
    const products = loadProductsFromJson();
    const { name, description, price, category, image, specs } = req.body || {};

    if (!name || !category) {
      return res.status(400).json({ error: 'Имя и категория обязательны' });
    }

    let newId = 1;
    if (products.length > 0) {
      newId = Math.max(...products.map(p => p.id || 0)) + 1;
    }

    const normalizedPrice = price === undefined || price === null || price === ''
      ? 'уточнить у продавца'
      : price;

    const newProduct = {
      id: newId,
      name,
      description: description || '',
      price: normalizedPrice,
      category,
      image: image || '💧',
      specs: specs && typeof specs === 'object' ? specs : {}
    };

    products.push(newProduct);
    saveProductsToJson(products);
    res.status(201).json(newProduct);
  } catch (err) {
    console.error('Ошибка при создании товара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновить товар
app.put('/api/admin/products/:id', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const products = loadProductsFromJson();
    const index = products.findIndex(p => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const existing = products[index];
    const { name, description, price, category, image, specs } = req.body || {};

    const updated = {
      ...existing,
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(image !== undefined ? { image } : {}),
      ...(price !== undefined
        ? {
            price:
              price === null || price === ''
                ? 'уточнить у продавца'
                : price
          }
        : {}),
      ...(specs !== undefined
        ? { specs: specs && typeof specs === 'object' ? specs : existing.specs }
        : {})
    };

    products[index] = updated;
    saveProductsToJson(products);
    res.json(updated);
  } catch (err) {
    console.error('Ошибка при обновлении товара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удалить товар
app.delete('/api/admin/products/:id', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const products = loadProductsFromJson();
    const index = products.findIndex(p => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const [removed] = products.splice(index, 1);
    saveProductsToJson(products);
    res.json({ ok: true, removed });
  } catch (err) {
    console.error('Ошибка при удалении товара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/products', (req, res) => {
  const q = req.query.q;
  let sql = 'SELECT id, name, description, price, category, image, specs FROM products';
  const params = [];
  if (q) {
    sql += ' WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?';
    const s = `%${q.toLowerCase()}%`;
    params.push(s, s, s);
  }
  sql += ' ORDER BY id';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    rows = rows.map(r => ({ ...r, specs: r.specs ? JSON.parse(r.specs) : {} }));
    res.json(rows);
  });
});

app.get('/api/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.get('SELECT id, name, description, price, category, image, specs FROM products WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    row.specs = row.specs ? JSON.parse(row.specs) : {};
    res.json(row);
  });
});

app.get('/api/categories', (req, res) => {
  db.all('SELECT DISTINCT category FROM products ORDER BY category', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => r.category));
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
