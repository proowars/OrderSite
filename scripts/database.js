// SQLite база данных с использованием SQL.js

class Database {
    constructor() {
        this.db = null;
        this.initialized = false;
        this.initPromise = this.init();
    }

    async init() {
        if (this.initialized) {
            console.log('init: база данных уже инициализирована');
            return;
        }
        
        console.log('init: начинаем инициализацию базы данных');
        try {
            // Ждем загрузки SQL.js (может занять время)
            let attempts = 0;
            while (typeof initSqlJs === 'undefined' && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            console.log('init: SQL.js загружен:', typeof initSqlJs !== 'undefined');

            if (typeof initSqlJs === 'undefined') {
                console.warn('SQL.js не загружен. Используется localStorage.');
                this.useLocalStorage = true;
                this.initLocalStorage();
                this.initialized = true;
                return;
            }

            const SQL = await initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });
                // Сохраняем ссылку на SQL для дальнейшего использования
                this.SQL = SQL;

            // Пытаемся загрузить существующий .db файл через File System Access API
            let dbLoaded = false;
            if (window.showOpenFilePicker) {
                try {
                    // Проверяем, есть ли сохраненный handle файла в IndexedDB
                    const savedHandle = await this.getSavedFileHandle();
                    if (savedHandle) {
                        try {
                            const file = await savedHandle.getFile();
                            const arrayBuffer = await file.arrayBuffer();
                            
                            // Проверяем, что файл не пустой
                            if (arrayBuffer.byteLength === 0) {
                                throw new Error('Файл пустой');
                            }
                            
                            const uint8Array = new Uint8Array(arrayBuffer);
                            this.db = new SQL.Database(uint8Array);
                            this._lastFileHandle = savedHandle;
                            dbLoaded = true;
                            console.log('База данных загружена из .db файла');
                            // Убеждаемся, что таблицы созданы и данные заполнены
                            this.createTables();
                            await this.seedData();
                            await this.saveDatabase();
                        } catch (e) {
                            console.warn('Не удалось загрузить сохраненный файл, создаем новый:', e);
                            // Удаляем невалидный handle
                            await this.clearSavedFileHandle();
                        }
                    }
                } catch (e) {
                    console.warn('Ошибка при попытке загрузить сохраненный файл:', e);
                }
            }

            // Если файл не загружен, проверяем localStorage
            if (!dbLoaded) {
                const savedDb = localStorage.getItem('aquatech_sqlite_db');
                
                if (savedDb) {
                    try {
                        const uint8Array = new Uint8Array(JSON.parse(savedDb));
                        this.db = new SQL.Database(uint8Array);
                        dbLoaded = true;
                        console.log('База данных загружена из localStorage');
                        // Убеждаемся, что таблицы созданы и данные заполнены
                        this.createTables();
                        await this.seedData();
                        await this.saveDatabase();
                    } catch (e) {
                        console.warn('Ошибка загрузки из localStorage:', e);
                    }
                }
            }

            // Если ничего не загружено, создаем новую БД
            if (!dbLoaded) {
                this.db = new SQL.Database();
                this.createTables();
                await this.seedData();
                await this.saveDatabase();
                
                // Автоматически создаем и сохраняем .db файл
                if (window.showSaveFilePicker) {
                    try {
                        await this.createDbFile();
                    } catch (e) {
                        console.warn('Не удалось создать .db файл автоматически:', e);
                        // Fallback - скачиваем файл
                        this.exportDatabaseToFile();
                    }
                } else {
                    // Fallback - скачиваем файл
                    this.exportDatabaseToFile();
                }
            }
            
            this.initialized = true;
            console.log('init: инициализация завершена успешно');
            
            // Проверяем, что товары доступны
            const testProducts = await this.getAllProducts();
            console.log('init: проверка - доступно товаров:', testProducts.length);
        } catch (error) {
            console.error('Ошибка инициализации SQLite:', error);
            // Fallback на localStorage
            this.useLocalStorage = true;
            this.initLocalStorage();
            this.initialized = true;
            console.log('init: используется fallback на localStorage');
        }
    }

    initLocalStorage() {
        this.storageKey = 'aquatech_products';
        if (!localStorage.getItem(this.storageKey)) {
            this.seedDataLocalStorage();
        }
    }

    // Сохранить handle файла в IndexedDB для последующей загрузки
    async saveFileHandle(fileHandle) {
        if (!('indexedDB' in window)) return;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('aquatech_db_handles', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['handles'], 'readwrite');
                const store = transaction.objectStore('handles');
                const saveRequest = store.put(fileHandle, 'db_file');
                saveRequest.onsuccess = () => resolve();
                saveRequest.onerror = () => reject(saveRequest.error);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles');
                }
            };
        });
    }

    // Загрузить сохраненный handle файла из IndexedDB
    async getSavedFileHandle() {
        if (!('indexedDB' in window)) return null;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('aquatech_db_handles', 1);
            
            request.onerror = () => resolve(null);
            request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('handles')) {
                    resolve(null);
                    return;
                }
                const transaction = db.transaction(['handles'], 'readonly');
                const store = transaction.objectStore('handles');
                const getRequest = store.get('db_file');
                getRequest.onsuccess = () => resolve(getRequest.result || null);
                getRequest.onerror = () => resolve(null);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles');
                }
            };
        });
    }

    // Удалить сохраненный handle
    async clearSavedFileHandle() {
        if (!('indexedDB' in window)) return;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('aquatech_db_handles', 1);
            
            request.onerror = () => resolve();
            request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('handles')) {
                    resolve();
                    return;
                }
                const transaction = db.transaction(['handles'], 'readwrite');
                const store = transaction.objectStore('handles');
                const deleteRequest = store.delete('db_file');
                deleteRequest.onsuccess = () => resolve();
                deleteRequest.onerror = () => resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles');
                }
            };
        });
    }

    // Создать новый .db файл и сохранить handle
    async createDbFile(filename = 'aquaphorm.db') {
        if (!this.db || !window.showSaveFilePicker) return false;

        try {
            const opts = {
                suggestedName: filename,
                types: [{ description: 'SQLite DB', accept: { 'application/octet-stream': ['.db'] } }]
            };
            const handle = await window.showSaveFilePicker(opts);
            const writable = await handle.createWritable();
            const data = this.db.export();
            await writable.write(new Uint8Array(data));
            await writable.close();
            this._lastFileHandle = handle;
            
            // Сохраняем handle для последующей загрузки
            await this.saveFileHandle(handle);
            console.log('.db файл создан и сохранен');
            return true;
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Ошибка при создании .db файла:', e);
            }
            return false;
        }
    }

    createTables() {
        if (!this.db) return;

        // Таблица товаров
        this.db.run(`
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
    }

    async saveDatabase() {
        if (!this.db || this.useLocalStorage) return;
        
        try {
            const data = this.db.export();
            const buffer = Array.from(data);
            localStorage.setItem('aquatech_sqlite_db', JSON.stringify(buffer));
            
            // Если есть открытый файл через File System Access API, сохраняем туда
            if (this._lastFileHandle) {
                try {
                    const writable = await this._lastFileHandle.createWritable();
                    await writable.write(new Uint8Array(data));
                    await writable.close();
                } catch (e) {
                    console.warn('Не удалось сохранить в файл, используем только localStorage:', e);
                    // Если файл был удален или недоступен, очищаем handle
                    if (e.name === 'NotFoundError' || e.name === 'InvalidStateError') {
                        this._lastFileHandle = null;
                        await this.clearSavedFileHandle();
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка сохранения БД:', error);
        }
    }

    // Экспорт БД в файл .db (скачивание пользователю)
    exportDatabaseToFile(filename = 'aquaphorm.db') {
        if (!this.db || this.useLocalStorage) return;

        try {
            const data = this.db.export();
            const blob = new Blob([new Uint8Array(data)], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Ошибка при экспорте .db файла:', e);
        }
    }

    // Импортировать БД из ArrayBuffer (например, выбранного .db файла)
    async importDatabaseFromArrayBuffer(arrayBuffer) {
        await this.initPromise;

        if (!this.SQL) {
            console.warn('SQL.js не инициализирован, импорт невозможен.');
            return false;
        }

        try {
            const uint8 = new Uint8Array(arrayBuffer);
            this.db = new this.SQL.Database(uint8);
            this.createTables();
            await this.saveDatabase();
            this.initialized = true;
            return true;
        } catch (e) {
            console.error('Ошибка импорта .db файла:', e);
            return false;
        }
    }

    // Открыть .db через File System Access API (выбор файла пользователем)
    async openDbWithPicker() {
        if (!window.showOpenFilePicker) {
            console.warn('File System Access API не поддерживается в этом браузере. Используйте поле загрузки.');
            return false;
        }

        try {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{ description: 'SQLite DB', accept: { 'application/octet-stream': ['.db'] } }],
                multiple: false
            });
            const file = await fileHandle.getFile();
            const arrayBuffer = await file.arrayBuffer();
            const ok = await this.importDatabaseFromArrayBuffer(arrayBuffer);
            if (ok) {
                this._lastFileHandle = fileHandle;
                // Сохраняем handle для последующей автоматической загрузки
                await this.saveFileHandle(fileHandle);
            }
            return ok;
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Ошибка при открытии .db через picker:', e);
            }
            return false;
        }
    }

    // Сохранить текущую БД в файл через File System Access API (save picker)
    async saveDbWithPicker(defaultName = 'aquaphorm.db') {
        if (!this.db) return false;

        if (!window.showSaveFilePicker) {
            // fallback — скачать файл
            this.exportDatabaseToFile(defaultName);
            return true;
        }

        try {
            const opts = {
                suggestedName: defaultName,
                types: [{ description: 'SQLite DB', accept: { 'application/octet-stream': ['.db'] } }]
            };
            const handle = await window.showSaveFilePicker(opts);
            const writable = await handle.createWritable();
            const data = this.db.export();
            await writable.write(new Uint8Array(data));
            await writable.close();
            this._lastFileHandle = handle;
            
            // Сохраняем handle для последующей автоматической загрузки
            await this.saveFileHandle(handle);
            return true;
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('Ошибка при сохранении .db через picker:', e);
            }
            return false;
        }
    }

    async seedData() {
        if (this.useLocalStorage) {
            this.seedDataLocalStorage();
            return;
        }

        await this.initPromise;
        if (!this.db) {
            console.warn('seedData: база данных не инициализирована');
            return;
        }

        try {
            // Проверяем, есть ли уже данные
            const result = this.db.exec("SELECT COUNT(*) as count FROM products");
            let count = 0;
            if (result.length > 0 && result[0].values && result[0].values[0]) {
                count = result[0].values[0][0];
            }
            
            console.log('seedData: количество товаров в БД:', count);
            
            if (count > 0) {
                console.log('seedData: данные уже есть, пропускаем заполнение');
                return; // Данные уже есть
            }

            console.log('seedData: заполняем базу данных товарами');
            const products = [
                ['Смеситель для раковины AquaFlow Pro', 'Современный смеситель с сенсорным управлением и функцией экономии воды. Изготовлен из нержавеющей стали высшего качества.', 12500, 'Смесители', '🚿', JSON.stringify({'Материал': 'Нержавеющая сталь', 'Тип': 'Однорычажный', 'Управление': 'Сенсорное', 'Гарантия': '5 лет'})],
                ['Душевая кабина SmartShower 2000', 'Инновационная душевая кабина с системой умного управления температурой и гидромассажем. Встроенная LED подсветка.', 45000, 'Душевые кабины', '🚿', JSON.stringify({'Размеры': '90x90 см', 'Материал': 'Закаленное стекло', 'Функции': 'Гидромассаж, LED подсветка', 'Гарантия': '3 года'})],
                ['Унитаз подвесной EcoFlush', 'Экологичный подвесной унитаз с системой двойного слива. Экономит до 50% воды по сравнению с обычными моделями.', 28000, 'Унитазы', '🚽', JSON.stringify({'Тип': 'Подвесной', 'Слив': 'Двойной (3/6 литров)', 'Материал': 'Керамика', 'Гарантия': '10 лет'})],
                ['Раковина накладная Crystal', 'Элегантная накладная раковина из искусственного камня. Устойчива к царапинам и пятнам.', 15000, 'Раковины', '🚰', JSON.stringify({'Материал': 'Искусственный камень', 'Размеры': '60x40 см', 'Цвет': 'Белый', 'Гарантия': '5 лет'})],
                ['Ванна акриловая Comfort 170', 'Просторная акриловая ванна с гидромассажной системой. Вместимость 170 литров, идеальна для релаксации.', 55000, 'Ванны', '🛁', JSON.stringify({'Размеры': '170x70 см', 'Материал': 'Акрил', 'Функции': 'Гидромассаж', 'Гарантия': '5 лет'})],
                ['Полотенцесушитель электрический Thermo', 'Современный электрический полотенцесушитель с терморегулятором. Безопасен и экономичен.', 8500, 'Полотенцесушители', '🔌', JSON.stringify({'Тип': 'Электрический', 'Мощность': '200 Вт', 'Размеры': '80x50 см', 'Гарантия': '2 года'})],
                ['Фильтр для воды AquaPure', 'Многоступенчатый фильтр для очистки воды. Удаляет хлор, тяжелые металлы и бактерии.', 12000, 'Фильтры', '💧', JSON.stringify({'Тип': 'Проточный', 'Ступени очистки': '5', 'Ресурс': '10000 литров', 'Гарантия': '1 год'})],
                ['Трубы полипропиленовые AquaPipe', 'Надежные полипропиленовые трубы для водоснабжения. Устойчивы к коррозии и перепадам температур.', 250, 'Трубы', '🔧', JSON.stringify({'Диаметр': '20 мм', 'Материал': 'Полипропилен', 'Длина': '2 метра', 'Гарантия': '50 лет'})]
            ];

            const stmt = this.db.prepare(`
                INSERT INTO products (name, description, price, category, image, specs)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            products.forEach(product => {
                stmt.run(product);
            });

            stmt.free();
            await this.saveDatabase();
            console.log('seedData: добавлено', products.length, 'товаров');
        } catch (error) {
            console.error('seedData: ошибка при заполнении данных:', error);
        }
    }

    seedDataLocalStorage() {
        const products = [
            {
                id: 1,
                name: 'Смеситель для раковины AquaFlow Pro',
                description: 'Современный смеситель с сенсорным управлением и функцией экономии воды. Изготовлен из нержавеющей стали высшего качества.',
                price: 12500,
                category: 'Смесители',
                image: '🚿',
                specs: {'Материал': 'Нержавеющая сталь', 'Тип': 'Однорычажный', 'Управление': 'Сенсорное', 'Гарантия': '5 лет'}
            },
            {
                id: 2,
                name: 'Душевая кабина SmartShower 2000',
                description: 'Инновационная душевая кабина с системой умного управления температурой и гидромассажем. Встроенная LED подсветка.',
                price: 45000,
                category: 'Душевые кабины',
                image: '🚿',
                specs: {'Размеры': '90x90 см', 'Материал': 'Закаленное стекло', 'Функции': 'Гидромассаж, LED подсветка', 'Гарантия': '3 года'}
            },
            {
                id: 3,
                name: 'Унитаз подвесной EcoFlush',
                description: 'Экологичный подвесной унитаз с системой двойного слива. Экономит до 50% воды по сравнению с обычными моделями.',
                price: 28000,
                category: 'Унитазы',
                image: '🚽',
                specs: {'Тип': 'Подвесной', 'Слив': 'Двойной (3/6 литров)', 'Материал': 'Керамика', 'Гарантия': '10 лет'}
            },
            {
                id: 4,
                name: 'Раковина накладная Crystal',
                description: 'Элегантная накладная раковина из искусственного камня. Устойчива к царапинам и пятнам.',
                price: 15000,
                category: 'Раковины',
                image: '🚰',
                specs: {'Материал': 'Искусственный камень', 'Размеры': '60x40 см', 'Цвет': 'Белый', 'Гарантия': '5 лет'}
            },
            {
                id: 5,
                name: 'Ванна акриловая Comfort 170',
                description: 'Просторная акриловая ванна с гидромассажной системой. Вместимость 170 литров, идеальна для релаксации.',
                price: 55000,
                category: 'Ванны',
                image: '🛁',
                specs: {'Размеры': '170x70 см', 'Материал': 'Акрил', 'Функции': 'Гидромассаж', 'Гарантия': '5 лет'}
            },
            {
                id: 6,
                name: 'Полотенцесушитель электрический Thermo',
                description: 'Современный электрический полотенцесушитель с терморегулятором. Безопасен и экономичен.',
                price: 8500,
                category: 'Полотенцесушители',
                image: '🔌',
                specs: {'Тип': 'Электрический', 'Мощность': '200 Вт', 'Размеры': '80x50 см', 'Гарантия': '2 года'}
            },
            {
                id: 7,
                name: 'Фильтр для воды AquaPure',
                description: 'Многоступенчатый фильтр для очистки воды. Удаляет хлор, тяжелые металлы и бактерии.',
                price: 12000,
                category: 'Фильтры',
                image: '💧',
                specs: {'Тип': 'Проточный', 'Ступени очистки': '5', 'Ресурс': '10000 литров', 'Гарантия': '1 год'}
            },
            {
                id: 8,
                name: 'Трубы полипропиленовые AquaPipe',
                description: 'Надежные полипропиленовые трубы для водоснабжения. Устойчивы к коррозии и перепадам температур.',
                price: 250,
                category: 'Трубы',
                image: '🔧',
                specs: {'Диаметр': '20 мм', 'Материал': 'Полипропилен', 'Длина': '2 метра', 'Гарантия': '50 лет'}
            }
        ];

        localStorage.setItem(this.storageKey, JSON.stringify(products));
    }

    async getAllProducts() {
        await this.initPromise;
        
        if (this.useLocalStorage) {
            const data = localStorage.getItem(this.storageKey);
            const products = data ? JSON.parse(data) : [];
            console.log('getAllProducts (localStorage):', products.length);
            return products;
        }

        if (!this.db) {
            console.warn('getAllProducts: база данных не инициализирована');
            return [];
        }

        try {
            const result = this.db.exec(`
                SELECT id, name, description, price, category, image, specs
                FROM products
                ORDER BY id
            `);

            if (result.length === 0) {
                console.log('getAllProducts: таблица products пуста');
                return [];
            }

            const columns = result[0].columns;
            const values = result[0].values;

            const products = values.map(row => {
                const product = {};
                columns.forEach((col, index) => {
                    product[col] = row[index];
                });
                product.id = product.id;
                product.price = product.price;
                product.specs = product.specs ? JSON.parse(product.specs) : {};
                return product;
            });
            
            console.log('getAllProducts (SQLite):', products.length, 'товаров');
            return products;
        } catch (error) {
            console.error('Ошибка при получении товаров:', error);
            return [];
        }
    }

    async getProductById(id) {
        await this.initPromise;
        
        if (this.useLocalStorage) {
            const products = this.getAllProductsSync();
            return products.find(p => p.id === parseInt(id));
        }

        if (!this.db) return null;

        const stmt = this.db.prepare(`
            SELECT id, name, description, price, category, image, specs
            FROM products
            WHERE id = ?
        `);

        stmt.bind([parseInt(id)]);
        const result = stmt.getAsObject();
        stmt.free();

        if (!result.id) return null;

        const product = {
            id: result.id,
            name: result.name,
            description: result.description,
            price: result.price,
            category: result.category,
            image: result.image,
            specs: result.specs ? JSON.parse(result.specs) : {}
        };

        return product;
    }

    async searchProducts(query) {
        await this.initPromise;
        
        if (this.useLocalStorage) {
            const products = this.getAllProductsSync();
            const lowerQuery = query.toLowerCase();
            return products.filter(product => 
                product.name.toLowerCase().includes(lowerQuery) ||
                product.description.toLowerCase().includes(lowerQuery) ||
                product.category.toLowerCase().includes(lowerQuery)
            );
        }

        if (!this.db) return [];

        const stmt = this.db.prepare(`
            SELECT id, name, description, price, category, image, specs
            FROM products
            WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?
        `);

        const searchTerm = `%${query.toLowerCase()}%`;
        stmt.bind([searchTerm, searchTerm, searchTerm]);

        const products = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            products.push({
                id: row.id,
                name: row.name,
                description: row.description,
                price: row.price,
                category: row.category,
                image: row.image,
                specs: row.specs ? JSON.parse(row.specs) : {}
            });
        }

        stmt.free();
        return products;
    }

    async getPopularProducts(limit = 4) {
        await this.initPromise;
        
        if (this.useLocalStorage) {
            const products = this.getAllProductsSync();
            return products.slice(0, limit);
        }

        if (!this.db) return [];

        const result = this.db.exec(`
            SELECT id, name, description, price, category, image, specs
            FROM products
            ORDER BY id
            LIMIT ${limit}
        `);

        if (result.length === 0) return [];

        const columns = result[0].columns;
        const values = result[0].values;

        return values.map(row => {
            const product = {};
            columns.forEach((col, index) => {
                product[col] = row[index];
            });
            product.id = product.id;
            product.price = product.price;
            product.specs = product.specs ? JSON.parse(product.specs) : {};
            return product;
        });
    }

    async getCategories() {
        await this.initPromise;
        
        if (this.useLocalStorage) {
            const products = this.getAllProductsSync();
            return [...new Set(products.map(p => p.category))];
        }

        if (!this.db) return [];

        const result = this.db.exec(`
            SELECT DISTINCT category
            FROM products
            ORDER BY category
        `);

        if (result.length === 0) return [];

        return result[0].values.map(row => row[0]);
    }

    getAllProductsSync() {
        if (this.useLocalStorage) {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        }
        return [];
    }
}

// Создаем глобальный экземпляр базы данных
const db = new Database();
