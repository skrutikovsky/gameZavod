// Состояние приложения
const state = {
    totalLevels: 10,
    currentLevel: 1,
    completedLevels: [],
    itemHeight: 140, // Высота элемента карусели с отступом
    visibleItems: 3, // Количество видимых элементов
};

// DOM элементы
const menuScreen = document.getElementById('menu-screen');
const levelScreen = document.getElementById('level-screen');
const levelCarousel = document.getElementById('levelCarousel');
const leftArrow = document.getElementById('leftArrow');
const rightArrow = document.getElementById('rightArrow');
const backButton = document.getElementById('backButton');
const completeButton = document.getElementById('completeButton');
const levelTitle = document.getElementById('levelTitle');
const levelNumber = document.getElementById('levelNumber');

// Инициализация
function init() {
    createLevelItems();
    updateCarousel();
    setupEventListeners();
    loadProgress();
}

// Создание элементов уровней
function createLevelItems() {
    levelCarousel.innerHTML = '';
    
    for (let i = 1; i <= state.totalLevels; i++) {
        const levelItem = document.createElement('div');
        levelItem.className = 'level-item';
        levelItem.dataset.level = i;
        levelItem.textContent = i;
        
        // Проверка, пройден ли уровень
        if (state.completedLevels.includes(i)) {
            levelItem.classList.add('completed');
        }
        
        // Блокировка уровней, которые еще недоступны
        if (i > 1 && !state.completedLevels.includes(i - 1)) {
            levelItem.classList.add('locked');
        }
        
        levelItem.addEventListener('click', () => selectLevel(i));
        levelCarousel.appendChild(levelItem);
    }
}

// Обновление позиции карусели
function updateCarousel() {
    const items = document.querySelectorAll('.level-item');
    const carouselHeight = document.querySelector('.carousel-wrapper').clientHeight;
    const centerOffset = carouselHeight / 2;
    
    items.forEach((item, index) => {
        const level = index + 1;
        const position = index - (state.currentLevel - 1);
        const yPos = position * state.itemHeight + centerOffset - state.itemHeight / 2;
        
        // Масштабирование и прозрачность в зависимости от позиции
        const scale = position === 0 ? 1 : 0.8 - Math.abs(position) * 0.1;
        const opacity = position === 0 ? 1 : 0.6 - Math.abs(position) * 0.2;
        const zIndex = 10 - Math.abs(position);
        
        item.style.transform = `translateX(-50%) translateY(${yPos}px) scale(${Math.max(0.6, scale)})`;
        item.style.opacity = Math.max(0.3, opacity);
        item.style.zIndex = zIndex;
        
        // Обновление статуса прохождения
        if (state.completedLevels.includes(level)) {
            item.classList.add('completed');
        } else {
            item.classList.remove('completed');
        }
        
        // Обновление блокировки
        if (level > 1 && !state.completedLevels.includes(level - 1)) {
            item.classList.add('locked');
        } else {
            item.classList.remove('locked');
        }
    });
}

// Выбор уровня
function selectLevel(level) {
    // Проверка, доступен ли уровень
    if (level > 1 && !state.completedLevels.includes(level - 1)) {
        return; // Уровень заблокирован
    }
    
    state.currentLevel = level;
    showLevelScreen();
}

// Показ экрана уровня
function showLevelScreen() {
    menuScreen.classList.remove('active');
    levelScreen.classList.add('active');
    
    levelTitle.textContent = `Уровень ${state.currentLevel}`;
    levelNumber.textContent = state.currentLevel;
    
    // Обновление кнопки "Пройден"
    updateCompleteButton();
}

// Обновление кнопки "Пройден"
function updateCompleteButton() {
    const isCompleted = state.completedLevels.includes(state.currentLevel);
    const isPreviousCompleted = state.currentLevel === 1 || 
                                state.completedLevels.includes(state.currentLevel - 1);
    
    completeButton.disabled = isCompleted || !isPreviousCompleted;
    
    if (isCompleted) {
        completeButton.textContent = '✓ Уже пройден';
    } else {
        completeButton.textContent = '✓ Пройден';
    }
}

// Возврат к меню
function showMenu() {
    levelScreen.classList.remove('active');
    menuScreen.classList.add('active');
    
    // Установка карусели на первый непройденный уровень
    const firstUncompleted = findFirstUncompletedLevel();
    if (firstUncompleted) {
        state.currentLevel = firstUncompleted;
    }
    
    updateCarousel();
    saveProgress();
}

// Поиск первого непройденного уровня
function findFirstUncompletedLevel() {
    for (let i = 1; i <= state.totalLevels; i++) {
        if (!state.completedLevels.includes(i)) {
            return i;
        }
    }
    return state.totalLevels; // Все уровни пройдены
}

// Завершение уровня
function completeCurrentLevel() {
    if (!state.completedLevels.includes(state.currentLevel)) {
        state.completedLevels.push(state.currentLevel);
        state.completedLevels.sort((a, b) => a - b);
        
        // Анимация завершения
        const currentItem = document.querySelector(`.level-item[data-level="${state.currentLevel}"]`);
        if (currentItem) {
            currentItem.classList.add('completed');
        }
        
        updateCompleteButton();
        saveProgress();
    }
}

// Обработчики событий для стрелок
function setupEventListeners() {
    // Стрелки навигации
    leftArrow.addEventListener('click', () => {
        if (state.currentLevel > 1) {
            state.currentLevel--;
            updateCarousel();
        }
    });
    
    rightArrow.addEventListener('click', () => {
        if (state.currentLevel < state.totalLevels) {
            state.currentLevel++;
            updateCarousel();
        }
    });
    
    // Кнопка назад
    backButton.addEventListener('click', showMenu);
    
    // Кнопка "Пройден"
    completeButton.addEventListener('click', completeCurrentLevel);
    
    // Прокрутка колесиком мыши
    let scrollTimeout;
    levelCarousel.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (e.deltaY > 0 && state.currentLevel < state.totalLevels) {
                state.currentLevel++;
                updateCarousel();
            } else if (e.deltaY < 0 && state.currentLevel > 1) {
                state.currentLevel--;
                updateCarousel();
            }
        }, 50);
    });
    
    // Drag-and-drop прокрутка
    let isDragging = false;
    let startY = 0;
    let startLevel = 1;
    
    levelCarousel.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startLevel = state.currentLevel;
        levelCarousel.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaY = e.clientY - startY;
        const threshold = 50; // Порог для переключения уровня
        
        if (deltaY > threshold && startLevel < state.totalLevels) {
            state.currentLevel = startLevel + 1;
            updateCarousel();
            startY = e.clientY;
            startLevel = state.currentLevel;
        } else if (deltaY < -threshold && startLevel > 1) {
            state.currentLevel = startLevel - 1;
            updateCarousel();
            startY = e.clientY;
            startLevel = state.currentLevel;
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        levelCarousel.style.cursor = 'grab';
    });
    
    // Поддержка touch событий для мобильных устройств
    levelCarousel.addEventListener('touchstart', (e) => {
        isDragging = true;
        startY = e.touches[0].clientY;
        startLevel = state.currentLevel;
    });
    
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        const deltaY = e.touches[0].clientY - startY;
        const threshold = 50;
        
        if (deltaY > threshold && startLevel < state.totalLevels) {
            state.currentLevel = startLevel + 1;
            updateCarousel();
            startY = e.touches[0].clientY;
            startLevel = state.currentLevel;
        } else if (deltaY < -threshold && startLevel > 1) {
            state.currentLevel = startLevel - 1;
            updateCarousel();
            startY = e.touches[0].clientY;
            startLevel = state.currentLevel;
        }
    });
    
    document.addEventListener('touchend', () => {
        isDragging = false;
    });
    
    // Клавиатурная навигация
    document.addEventListener('keydown', (e) => {
        if (menuScreen.classList.contains('active')) {
            if (e.key === 'ArrowUp' && state.currentLevel > 1) {
                state.currentLevel--;
                updateCarousel();
            } else if (e.key === 'ArrowDown' && state.currentLevel < state.totalLevels) {
                state.currentLevel++;
                updateCarousel();
            }
        }
    });
}

// Сохранение прогресса в localStorage
function saveProgress() {
    localStorage.setItem('factoryGameProgress', JSON.stringify({
        completedLevels: state.completedLevels
    }));
}

// Загрузка прогресса из localStorage
function loadProgress() {
    const saved = localStorage.getItem('factoryGameProgress');
    if (saved) {
        const data = JSON.parse(saved);
        state.completedLevels = data.completedLevels || [];
    }
    
    // Установка начальной позиции на первый непройденный уровень
    const firstUncompleted = findFirstUncompletedLevel();
    state.currentLevel = firstUncompleted;
    
    updateCarousel();
}

// Запуск приложения
init();
