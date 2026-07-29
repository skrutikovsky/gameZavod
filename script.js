// Состояние приложения
const state = {
    totalLevels: 10,
    currentLevel: 1,
    completedLevels: [],
    itemWidth: 140, // Ширина элемента карусели с отступом
    visibleItems: 3, // Количество видимых элементов
};

// DOM элементы
const menuScreen = document.getElementById('menu-screen');
const levelScreen = document.getElementById('level-screen');
const gameScreen = document.getElementById('game-screen');
const levelCarousel = document.getElementById('levelCarousel');
const leftArrow = document.getElementById('leftArrow');
const rightArrow = document.getElementById('rightArrow');
const backButton = document.getElementById('backButton');
const completeButton = document.getElementById('completeButton');
const startGameButton = document.getElementById('startGameButton');
const levelTitle = document.getElementById('levelTitle');
const levelNumber = document.getElementById('levelNumber');
const statsModal = document.getElementById('stats-modal');

// Переменные игры
let gameRunning = false;
let gameLoopId = null;
let score = 0;
let lives = 3;
let boxesFixed = 0;
let gameTime = 0;
let multiplier = 1;
let comboCount = 0;
let maxMultiplier = 1;
let conveyorSpeed = 2;
let spawnRate = 1500;
let lastSpawnTime = 0;
let boxes = [];
let handPosition = 'left'; // 'left' или 'right'

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
    const carouselWidth = document.querySelector('.carousel-wrapper').clientWidth;
    const centerOffset = carouselWidth / 2;
    
    items.forEach((item, index) => {
        const level = index + 1;
        const position = index - (state.currentLevel - 1);
        const xPos = position * state.itemWidth + centerOffset - state.itemWidth / 2;
        
        // Масштабирование и прозрачность в зависимости от позиции
        const scale = position === 0 ? 1 : 0.8 - Math.abs(position) * 0.1;
        const opacity = position === 0 ? 1 : 0.6 - Math.abs(position) * 0.2;
        const zIndex = 10 - Math.abs(position);
        
        item.style.transform = `translate(-50%, -50%) translateX(${xPos - centerOffset}px) scale(${Math.max(0.6, scale)})`;
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
    
    // Кнопка "Начать игру"
    startGameButton.addEventListener('click', startGame);
    
    // Кнопки модального окна
    document.getElementById('restartLevelBtn').addEventListener('click', restartGame);
    document.getElementById('backToMenuFromStats').addEventListener('click', backToMenuFromStats);
    
    // Прокрутка колесиком мыши
    let scrollTimeout;
    levelCarousel.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if (e.deltaX > 0 && state.currentLevel < state.totalLevels) {
                state.currentLevel++;
                updateCarousel();
            } else if (e.deltaX < 0 && state.currentLevel > 1) {
                state.currentLevel--;
                updateCarousel();
            }
        }, 50);
    });
    
    // Drag-and-drop прокрутка
    let isDragging = false;
    let startX = 0;
    let startLevel = 1;
    
    levelCarousel.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startLevel = state.currentLevel;
        levelCarousel.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const threshold = 50; // Порог для переключения уровня
        
        if (deltaX > threshold && startLevel < state.totalLevels) {
            state.currentLevel = startLevel + 1;
            updateCarousel();
            startX = e.clientX;
            startLevel = state.currentLevel;
        } else if (deltaX < -threshold && startLevel > 1) {
            state.currentLevel = startLevel - 1;
            updateCarousel();
            startX = e.clientX;
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
        startX = e.touches[0].clientX;
        startLevel = state.currentLevel;
    });
    
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.touches[0].clientX - startX;
        const threshold = 50;
        
        if (deltaX > threshold && startLevel < state.totalLevels) {
            state.currentLevel = startLevel + 1;
            updateCarousel();
            startX = e.touches[0].clientX;
            startLevel = state.currentLevel;
        } else if (deltaX < -threshold && startLevel > 1) {
            state.currentLevel = startLevel - 1;
            updateCarousel();
            startX = e.touches[0].clientX;
            startLevel = state.currentLevel;
        }
    });
    
    document.addEventListener('touchend', () => {
        isDragging = false;
    });
    
    // Клавиатурная навигация
    document.addEventListener('keydown', (e) => {
        if (menuScreen.classList.contains('active')) {
            if (e.key === 'ArrowLeft' && state.currentLevel > 1) {
                state.currentLevel--;
                updateCarousel();
            } else if (e.key === 'ArrowRight' && state.currentLevel < state.totalLevels) {
                state.currentLevel++;
                updateCarousel();
            }
        } else if (gameScreen.classList.contains('active') && gameRunning) {
            // Управление рукой в игре
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ф') {
                moveHand('left');
            } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'в') {
                moveHand('right');
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

// ==================== ФУНКЦИИ ИГРЫ ====================

// Старт игры
function startGame() {
    if (state.currentLevel !== 1) {
        alert('Игра доступна только на первом уровне!');
        return;
    }
    
    levelScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    resetGameVariables();
    gameRunning = true;
    lastSpawnTime = performance.now();
    gameLoopId = requestAnimationFrame(gameLoop);
}

// Сброс переменных игры
function resetGameVariables() {
    score = 0;
    lives = 3;
    boxesFixed = 0;
    gameTime = 0;
    multiplier = 1;
    comboCount = 0;
    maxMultiplier = 1;
    conveyorSpeed = 2;
    spawnRate = 1500;
    boxes = [];
    handPosition = 'left';
    
    // Очистка конвейера
    const conveyorBelt = document.getElementById('conveyorBelt');
    const existingBoxes = conveyorBelt.querySelectorAll('.box');
    existingBoxes.forEach(box => box.remove());
    
    // Обновление UI
    updateGameUI();
    updateHandPosition();
}

// Обновление UI игры
function updateGameUI() {
    document.getElementById('scoreDisplay').textContent = score;
    document.getElementById('livesDisplay').textContent = '❤️'.repeat(lives);
    
    let multiplierText = 'x' + multiplier.toFixed(1);
    if (multiplier === 1) {
        multiplierText = 'x1';
    }
    document.getElementById('multiplierDisplay').textContent = multiplierText;
}

// Движение руки
function moveHand(position) {
    if (!gameRunning) return;
    
    handPosition = position;
    updateHandPosition();
}

// Обновление позиции руки
function updateHandPosition() {
    const playerHand = document.getElementById('playerHand');
    if (handPosition === 'left') {
        playerHand.classList.remove('hand-right');
        playerHand.classList.add('hand-left');
    } else {
        playerHand.classList.remove('hand-left');
        playerHand.classList.add('hand-right');
    }
}

// Игровой цикл
function gameLoop(timestamp) {
    if (!gameRunning) return;
    
    // Обновление времени
    gameTime += 16; // примерно 16мс на кадр
    
    // Увеличение сложности со временем
    if (gameTime > 10000) {
        conveyorSpeed = 3;
        spawnRate = 1200;
    }
    if (gameTime > 20000) {
        conveyorSpeed = 4;
        spawnRate = 1000;
    }
    if (gameTime > 30000) {
        conveyorSpeed = 5;
        spawnRate = 800;
    }
    
    // Спавн коробок
    if (timestamp - lastSpawnTime > spawnRate) {
        spawnBox();
        lastSpawnTime = timestamp;
    }
    
    // Обновление позиций коробок
    updateBoxes();
    
    gameLoopId = requestAnimationFrame(gameLoop);
}

// Спавн коробки
function spawnBox() {
    const conveyorBelt = document.getElementById('conveyorBelt');
    const box = document.createElement('div');
    box.className = 'box';
    
    // Случайный тип: прямая или наклоненная
    const randomType = Math.random();
    let boxType;
    if (randomType < 0.3) {
        boxType = 'straight';
        box.classList.add('straight');
        box.dataset.type = 'straight';
        box.textContent = '';
    } else if (randomType < 0.65) {
        boxType = 'tilted-left';
        box.classList.add('tilted-left');
        box.dataset.type = 'tilted-left';
        box.textContent = '↙';
    } else {
        boxType = 'tilted-right';
        box.classList.add('tilted-right');
        box.dataset.type = 'tilted-right';
        box.textContent = '↘';
    }
    
    box.style.top = '60px';
    box.dataset.y = 60;
    box.dataset.fixed = 'false';
    
    conveyorBelt.appendChild(box);
    boxes.push(box);
}

// Обновление позиций коробок
function updateBoxes() {
    const conveyorBelt = document.getElementById('conveyorBelt');
    const beltHeight = conveyorBelt.clientHeight;
    const fixZone = beltHeight - 150; // Зона, где можно исправить коробку
    
    for (let i = boxes.length - 1; i >= 0; i--) {
        const box = boxes[i];
        let y = parseFloat(box.dataset.y);
        y += conveyorSpeed;
        box.dataset.y = y;
        box.style.top = y + 'px';
        
        // Проверка, нужно ли исправлять коробку
        const boxType = box.dataset.type;
        const isFixed = box.dataset.fixed === 'true';
        
        if ((boxType === 'tilted-left' || boxType === 'tilted-right') && !isFixed) {
            // Проверка, находится ли коробка в зоне исправления
            if (y >= fixZone && y <= fixZone + 100) {
                // Проверка, правильная ли сторона руки
                const correctHand = boxType === 'tilted-left' ? 'right' : 'left';
                
                if (handPosition === correctHand) {
                    // Исправление коробки
                    fixBox(box);
                }
            }
        }
        
        // Коробка достигла конца конвейера
        if (y > beltHeight - 20) {
            if (boxType === 'tilted-left' || boxType === 'tilted-right') {
                // Пропущена наклоненная коробка - потеря жизни
                loseLife(box);
            }
            // Удаление коробки
            box.remove();
            boxes.splice(i, 1);
        }
    }
}

// Исправление коробки
function fixBox(box) {
    box.dataset.fixed = 'true';
    box.classList.remove('tilted-left', 'tilted-right');
    box.classList.add('straight', 'fixing');
    box.textContent = '';
    
    // Анимация выпрямления
    setTimeout(() => {
        box.classList.remove('fixing');
    }, 300);
    
    // Начисление очков
    boxesFixed++;
    comboCount++;
    
    // Расчет множителя
    if (comboCount >= 30) {
        multiplier = 2;
    } else if (comboCount >= 10) {
        multiplier = 1.5;
    } else {
        multiplier = 1;
    }
    
    maxMultiplier = Math.max(maxMultiplier, multiplier);
    score += Math.floor(100 * multiplier);
    
    updateGameUI();
}

// Потеря жизни
function loseLife(box) {
    lives--;
    comboCount = 0;
    multiplier = 1;
    
    // Анимация получения урона
    box.classList.add('damaged');
    
    updateGameUI();
    
    if (lives <= 0) {
        endGame();
    }
}

// Конец игры
function endGame() {
    gameRunning = false;
    cancelAnimationFrame(gameLoopId);
    
    // Показ статистики
    document.getElementById('statsBoxes').textContent = boxesFixed;
    document.getElementById('statsScore').textContent = score;
    
    const minutes = Math.floor(gameTime / 60000);
    const seconds = Math.floor((gameTime % 60000) / 1000);
    document.getElementById('statsTime').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    let multiplierText = 'x' + maxMultiplier.toFixed(1);
    if (maxMultiplier === 1) {
        multiplierText = 'x1';
    }
    document.getElementById('statsMultiplier').textContent = multiplierText;
    
    statsModal.classList.add('active');
}

// Перезапуск игры
function restartGame() {
    statsModal.classList.remove('active');
    resetGameVariables();
    gameRunning = true;
    lastSpawnTime = performance.now();
    gameLoopId = requestAnimationFrame(gameLoop);
}

// Возврат в меню из статистики
function backToMenuFromStats() {
    statsModal.classList.remove('active');
    gameScreen.classList.remove('active');
    menuScreen.classList.add('active');
    
    // Установка карусели на первый непройденный уровень
    const firstUncompleted = findFirstUncompletedLevel();
    state.currentLevel = firstUncompleted;
    updateCarousel();
}
