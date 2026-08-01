import { useState, useCallback, useRef, useEffect } from 'react';

// Типы предметов и их характеристики
const ITEM_TYPES = [
  { id: 1, name: 'чип', points: 3500, probability: 0.03 },
  { id: 2, name: 'предохранитель', points: 2500, probability: 0.07 },
  { id: 3, name: 'лампочка', points: 1500, probability: 0.15 },
  { id: 4, name: 'пружина', points: 800, probability: 0.20 },
  { id: 5, name: 'гайка', points: 450, probability: 0.25 },
  { id: 6, name: 'болт', points: 400, probability: 0.30 },
];

const MAX_BOX_COUNT = 25;
const TOTAL_ITEMS_PER_ROUND = 60;

// Функция для выбора случайного типа предмета с учетом вероятностей
const getRandomItemType = () => {
  const rand = Math.random();
  let cumulative = 0;
  for (const type of ITEM_TYPES) {
    cumulative += type.probability;
    if (rand < cumulative) {
      return type.id;
    }
  }
  return ITEM_TYPES[ITEM_TYPES.length - 1].id;
};

// Генерация 60 предметов с заданными пропорциями
const generateItems = (startFromTop = false) => {
  const items = [];
  const counts = [
    Math.round(TOTAL_ITEMS_PER_ROUND * 0.03), // тип 1 - 3%
    Math.round(TOTAL_ITEMS_PER_ROUND * 0.07), // тип 2 - 7%
    Math.round(TOTAL_ITEMS_PER_ROUND * 0.15), // тип 3 - 15%
    Math.round(TOTAL_ITEMS_PER_ROUND * 0.20), // тип 4 - 20%
    Math.round(TOTAL_ITEMS_PER_ROUND * 0.25), // тип 5 - 25%
    Math.round(TOTAL_ITEMS_PER_ROUND * 0.30), // тип 6 - 30%
  ];

  // Корректировка чтобы сумма была ровно 60
  let total = counts.reduce((a, b) => a + b, 0);
  if (total < TOTAL_ITEMS_PER_ROUND) {
    counts[5] += TOTAL_ITEMS_PER_ROUND - total;
  } else if (total > TOTAL_ITEMS_PER_ROUND) {
    counts[5] -= total - TOTAL_ITEMS_PER_ROUND;
  }

  let itemId = 0;
  for (let typeIdx = 0; typeIdx < counts.length; typeIdx++) {
    for (let i = 0; i < counts[typeIdx]; i++) {
      const targetY = Math.random() * 80 + 10; // Целевая позиция для анимации падения (10-90% высоты)
      items.push({
        id: `item-${itemId++}`,
        type: typeIdx + 1,
        x: Math.random() * 80 + 10, // 10-90% ширины правой части
        y: startFromTop ? -20 : targetY, // При старте сверху (-20%), иначе целевая позиция
        targetY: targetY,
        isFalling: startFromTop, // Флаг анимации падения
      });
    }
  }

  // Перемешиваем предметы
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
};

export const useGame3 = () => {
  const [gameState, setGameState] = useState({
    score: 0,
    boxes: Array.from({ length: 6 }, (_, i) => ({
      type: i + 1,
      count: 0,
      points: ITEM_TYPES[i].points,
      name: ITEM_TYPES[i].name,
    })),
    items: [],
    draggedItem: null,
    dragPosition: { x: 0, y: 0 },
    isRoundComplete: false,
    gameStarted: false, // Флаг что игра началась (для анимации первого респавна)
  });

  const draggedItemRef = useRef(null);
  const originalPositionRef = useRef(null);
  const initialSpawnTimeoutRef = useRef(null);

  const startGame = useCallback(() => {
    // Спавним предметы сразу для анимации падения
    setGameState(prev => ({
      ...prev,
      items: [], // Пустой массив при старте
      score: 0,
      boxes: Array.from({ length: 6 }, (_, i) => ({
        type: i + 1,
        count: 0,
        points: ITEM_TYPES[i].points,
        name: ITEM_TYPES[i].name,
      })),
      isRoundComplete: false,
      gameStarted: true,
    }));

    // Запускаем анимацию падения предметов сразу (без задержки)
    if (initialSpawnTimeoutRef.current) {
      clearTimeout(initialSpawnTimeoutRef.current);
    }
    // Небольшая задержка в 100мс чтобы DOM успел отрендериться
    initialSpawnTimeoutRef.current = setTimeout(() => {
      const initialItems = generateItems(true); // true = старт сверху для анимации падения
      setGameState(prev => ({
        ...prev,
        items: initialItems,
      }));
    }, 100);
  }, []);

  const handleDragStart = useCallback((item, event) => {
    draggedItemRef.current = item;
    originalPositionRef.current = { x: item.x, y: item.y };
    
    const rect = event.target.getBoundingClientRect();
    setGameState(prev => ({
      ...prev,
      draggedItem: item,
      dragPosition: {
        x: event.clientX || (event.touches?.[0]?.clientX || 0),
        y: event.clientY || (event.touches?.[0]?.clientY || 0),
      },
    }));
  }, []);

  const handleDragMove = useCallback((event) => {
    if (!draggedItemRef.current) return;

    const clientX = event.clientX || event.touches?.[0]?.clientX || 0;
    const clientY = event.clientY || event.touches?.[0]?.clientY || 0;

    setGameState(prev => ({
      ...prev,
      dragPosition: { x: clientX, y: clientY },
    }));
  }, []);

  const handleDragEnd = useCallback((dropZone, dragPosition) => {
    if (!draggedItemRef.current) return;

    const item = draggedItemRef.current;
    const originalPos = originalPositionRef.current;

    setGameState(prev => {
      // Если dropped в соответствующую коробку
      if (typeof dropZone === 'number' && dropZone === item.type) {
        const box = prev.boxes.find(b => b.type === item.type);
        const newCount = box.count + 1;
        let pointsEarned = 0;
        
        const newBoxes = prev.boxes.map(b => {
          if (b.type === item.type) {
            if (newCount >= MAX_BOX_COUNT) {
              // Коробка заполнена - начисляем очки и сбрасываем счетчик
              pointsEarned = b.points;
              return {
                ...b,
                count: 0,
              };
            }
            return {
              ...b,
              count: newCount,
            };
          }
          return b;
        });

        // Удаляем предмет из списка
        const newItems = prev.items.filter(i => i.id !== item.id);

        return {
          ...prev,
          score: prev.score + pointsEarned,
          boxes: newBoxes,
          items: newItems,
          draggedItem: null,
        };
      }

      // Если dropped на доску-плоскость - предмет остается там где его бросили
      if (dropZone === 'board') {
        // Вычисляем новые координаты относительно правой части
        const rightPanel = document.querySelector('[data-right-panel]');
        if (rightPanel) {
          const rect = rightPanel.getBoundingClientRect();
          // Учитываем размер предмета (48px = w-12) для центрирования под курсором
          const itemSize = 48;
          const newX = ((dragPosition.x - rect.left - itemSize / 2) / rect.width) * 100;
          const newY = ((dragPosition.y - rect.top - itemSize / 2) / rect.height) * 100;
          
          // Ограничиваем координаты пределами доски (5-95%)
          const clampedX = Math.max(5, Math.min(95, newX));
          const clampedY = Math.max(5, Math.min(95, newY));
          
          const newItems = prev.items.map(i => {
            if (i.id === item.id) {
              return {
                ...i,
                x: clampedX,
                y: clampedY,
                targetY: clampedY, // Обновляем targetY для корректного отображения
                isFalling: false, // Сбрасываем флаг падения
              };
            }
            return i;
          });

          return {
            ...prev,
            items: newItems,
            draggedItem: null,
          };
        }
      }

      // В любом другом случае - возвращаем предмет обратно
      return {
        ...prev,
        draggedItem: null,
      };
    });

    draggedItemRef.current = null;
    originalPositionRef.current = null;
  }, []);

  const updateItemPosition = useCallback((itemId, newX, newY) => {
    setGameState(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId
          ? { ...item, x: newX, y: newY }
          : item
      ),
    }));
  }, []);

  // Проверка завершения раунда
  const checkRoundComplete = useCallback(() => {
    setGameState(prev => {
      if (prev.items.length === 0 && !prev.isRoundComplete) {
        // Все предметы разложены - спавним новые
        const newItems = generateItems();
        return {
          ...prev,
          items: newItems,
          isRoundComplete: true,
        };
      }
      return prev;
    });
  }, []);

  // Эффект для проверки завершения раунда (респавн после очистки всех предметов)
  useEffect(() => {
    if (gameState.items.length === 0 && gameState.gameStarted) {
      setTimeout(() => {
        const newItems = generateItems(true); // true = старт сверху для анимации падения
        setGameState(prev => ({
          ...prev,
          items: newItems,
        }));
      }, 500);
    }
  }, [gameState.items.length, gameState.gameStarted]);

  // Эффект для завершения анимации падения предметов
  useEffect(() => {
    const fallingItems = gameState.items.filter(item => item.isFalling);
    if (fallingItems.length > 0) {
      const timeout = setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          items: prev.items.map(item => ({
            ...item,
            isFalling: false,
            y: item.targetY, // Устанавливаем финальную позицию
          })),
        }));
      }, 1000); // Время анимации должно совпадать с transition в CSS (1s для dropBounce)
      return () => clearTimeout(timeout);
    }
  }, [gameState.items]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (initialSpawnTimeoutRef.current) {
        clearTimeout(initialSpawnTimeoutRef.current);
      }
    };
  }, []);

  return {
    gameState,
    startGame,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    updateItemPosition,
    checkRoundComplete,
    ITEM_TYPES,
    MAX_BOX_COUNT,
  };
};
