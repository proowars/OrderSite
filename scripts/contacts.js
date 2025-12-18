// Обработка формы контактов

document.addEventListener('DOMContentLoaded', () => {
    setupContactForm();
});

function setupContactForm() {
    const form = document.getElementById('contact-form');
    
    if (!form) return;
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            message: document.getElementById('message').value
        };
        
        // Сохраняем в localStorage (в реальном приложении отправляли бы на сервер)
        const messages = JSON.parse(localStorage.getItem('contact_messages') || '[]');
        messages.push({
            ...formData,
            date: new Date().toISOString()
        });
        localStorage.setItem('contact_messages', JSON.stringify(messages));
        
        // Показываем сообщение об успехе
        alert('Спасибо за ваше сообщение! Мы свяжемся с вами в ближайшее время.');
        
        // Очищаем форму
        form.reset();
    });
}
