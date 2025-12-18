// Отчет о проделанных работах - Портфолио

document.addEventListener('DOMContentLoaded', () => {
    loadPortfolio();
    loadReportData();
});

// Данные портфолио выполненных работ
const portfolioData = [
    {
        id: 1,
        title: 'Полная замена сантехники в квартире',
        description: 'Выполнена полная замена сантехнического оборудования в трехкомнатной квартире. Установлены современные смесители, раковины, унитаз и душевая кабина. Работы выполнены с соблюдением всех норм и стандартов.',
        image: '🏠',
        tags: ['Замена', 'Квартира', 'Полный монтаж'],
        date: 'Март 2024',
        location: 'г. Москва, ул. Ленина, д. 45'
    },
    {
        id: 2,
        title: 'Установка душевой кабины премиум класса',
        description: 'Монтаж элитной душевой кабины с гидромассажем и LED подсветкой. Установлена система умного управления температурой воды. Работа выполнена за 2 дня.',
        image: '🚿',
        tags: ['Душевая кабина', 'Премиум', 'Гидромассаж'],
        date: 'Февраль 2024',
        location: 'г. Москва, ул. Пушкина, д. 12'
    },
    {
        id: 3,
        title: 'Монтаж системы отопления в частном доме',
        description: 'Установка современной системы отопления с радиаторами и теплым полом. Настроена автоматическая регулировка температуры. Проект выполнен под ключ.',
        image: '🔥',
        tags: ['Отопление', 'Частный дом', 'Теплый пол'],
        date: 'Январь 2024',
        location: 'Московская область, д. Подмосковное'
    },
    {
        id: 4,
        title: 'Ремонт и замена труб водоснабжения',
        description: 'Полная замена старых металлических труб на современные полипропиленовые. Установлены фильтры для очистки воды. Работы выполнены без нарушения отделки.',
        image: '🔧',
        tags: ['Трубы', 'Водоснабжение', 'Фильтры'],
        date: 'Декабрь 2023',
        location: 'г. Москва, ул. Мира, д. 78'
    },
    {
        id: 5,
        title: 'Установка ванны с гидромассажем',
        description: 'Монтаж просторной акриловой ванны с системой гидромассажа. Подключена система автоматического наполнения и поддержания температуры воды.',
        image: '🛁',
        tags: ['Ванна', 'Гидромассаж', 'Акрил'],
        date: 'Ноябрь 2023',
        location: 'г. Москва, ул. Гагарина, д. 33'
    },
    {
        id: 6,
        title: 'Сантехнические работы в офисном центре',
        description: 'Комплексная установка сантехники в новом офисном центре. Установлены 15 санузлов, кухонные зоны и система водоснабжения. Проект выполнен в срок.',
        image: '🏢',
        tags: ['Офис', 'Комплексный проект', 'Коммерция'],
        date: 'Октябрь 2023',
        location: 'г. Москва, БЦ "Современный"'
    }
];

function loadPortfolio() {
    const grid = document.getElementById('portfolio-grid');
    
    if (!grid) return;
    
    grid.innerHTML = '';
    
    portfolioData.forEach(project => {
        const card = createPortfolioCard(project);
        grid.appendChild(card);
    });
}

function createPortfolioCard(project) {
    const card = document.createElement('div');
    card.className = 'portfolio-card';
    
    const tagsHtml = project.tags.map(tag => 
        `<span class="portfolio-tag">${tag}</span>`
    ).join('');
    
    card.innerHTML = `
        <div class="portfolio-image">
            ${project.image}
        </div>
        <div class="portfolio-content">
            <h3 class="portfolio-title">${project.title}</h3>
            <p class="portfolio-description">${project.description}</p>
            <div class="portfolio-details">
                ${tagsHtml}
            </div>
            <div class="portfolio-date">
                📅 ${project.date} | 📍 ${project.location}
            </div>
        </div>
    `;
    
    return card;
}

// Загрузка статистики по товарам из JSON
async function loadReportData() {
    try {
        const resp = await fetch('data/products.json');
        const products = await resp.json();
        
        const categoriesSet = new Set(products.map(p => p.category));
        const categories = Array.from(categoriesSet);
        
        const totalProducts = document.getElementById('total-products');
        const totalCategories = document.getElementById('total-categories');
        const totalProjects = document.getElementById('total-projects');
        
        if (totalProducts) {
            totalProducts.textContent = products.length;
        }
        
        if (totalCategories) {
            totalCategories.textContent = categories.length;
        }
        
        if (totalProjects) {
            totalProjects.textContent = portfolioData.length;
        }
    } catch (err) {
        console.error('Ошибка загрузки статистики для отчета:', err);
    }
}
