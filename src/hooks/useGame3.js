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
const generateItems = () => {
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
      const targetY = Math.random() * 80 + 10; // 10-90% высоты
      const targetX = Math.random() * 80 + 10; // 10-90% ширины
      
      items.push({
        id: `item-${itemId++}`,
        type: typeIdx + 1,
        x: targetX,
        y: targetY,
        // Для анимации падения: начальная позиция сверху (-10%), текущая анимационная позиция
        animX: targetX,
        animY: -10,
        isFalling: true,
        bouncePhase: 0,
        bounceOffsetX: 0,
        bounceOffsetY: 0,
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
  });

  const draggedItemRef = useRef(null);
  const originalPositionRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 }); // Смещение точки захвата предмета
  const animationFrameRef = useRef(null);
  const itemsInitializedRef = useRef(false);

  const startGame = useCallback(() => {
    const initialItems = generateItems();
    itemsInitializedRef.current = true;
    
    setGameState(prev => ({
      ...prev,
      items: initialItems,
      score: 0,
      boxes: Array.from({ length: 6 }, (_, i) => ({
        type: i + 1,
        count: 0,
        points: ITEM_TYPES[i].points,
        name: ITEM_TYPES[i].name,
      })),
      isRoundComplete: false,
    }));
  }, []);

  const handleDragStart = useCallback((item, event) => {
    draggedItemRef.current = item;
    originalPositionRef.current = { x: item.x, y: item.y };
    
    const rect = event.target.getBoundingClientRect();
    const clientX = event.clientX || (event.touches?.[0]?.clientX || 0);
    const clientY = event.clientY || (event.touches?.[0]?.clientY || 0);
    
    // Сохраняем смещение точки захвата относительно левого верхнего угла предмета
    dragOffsetRef.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    
    setGameState(prev => ({
      ...prev,
      draggedItem: item,
      dragPosition: {
        x: clientX,
        y: clientY,
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

  const handleDragEnd = useCallback((dropZone) => {
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
          
          // Учитываем смещение точки захвата предмета относительно его левого верхнего угла
          // dragOffsetRef хранит смещение где мы схватили предмет (в пикселях относительно элемента)
          // Нам нужно компенсировать это смещение чтобы предмет появился точно под курсором
          const itemSizePx = 48; // w-12 h-12 = 48px
          const offsetFractionX = (dragOffsetRef.current?.x || itemSizePx / 2) / itemSizePx;
          const offsetFractionY = (dragOffsetRef.current?.y || itemSizePx / 2) / itemSizePx;
          
          // Позиция курсора относительно панели с учетом точки захвата
          // Мы хотим чтобы центр предмета был там где курсор, но с учетом того где мы его взяли
          const cursorX = gameState.dragPosition.x - rect.left;
          const cursorY = gameState.dragPosition.y - rect.top;
          
          // Вычисляем позицию левого верхнего угла предмета так, чтобы точка захвата была под курсором
          const newXPercent = ((cursorX - offsetFractionX * itemSizePx) / rect.width) * 100;
          const newYPercent = ((cursorY - offsetFractionY * itemSizePx) / rect.height) * 100;
          
          // Ограничиваем координаты пределами доски (5-95%)
          const clampedX = Math.max(5, Math.min(95, newXPercent));
          const clampedY = Math.max(5, Math.min(95, newYPercent));
          
          const newItems = prev.items.map(i => {
            if (i.id === item.id) {
              return {
                ...i,
                x: clampedX,
                y: clampedY,
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
  }, [gameState.dragPosition]);

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

  // Анимация падения предметов с отскоками
  useEffect(() => {
    if (!itemsInitializedRef.current || gameState.items.length === 0) return;

    const animateItems = () => {
      let needsAnimation = false;
      
      setGameState(prev => {
        const updatedItems = prev.items.map(item => {
          if (!item.isFalling) return item;
          
          needsAnimation = true;
          
          const targetX = item.x;
          const targetY = item.y;
          
          // Фаза 1: Падение сверху до целевой Y позиции
          if (item.animY < targetY) {
            const fallSpeed = 3; // Скорость падения
            let newY = item.animY + fallSpeed;
            
            if (newY >= targetY) {
              newY = targetY;
              // Предмет достиг целевой позиции по Y, начинаем отскоки
              return {
                ...item,
                animY: newY,
                bouncePhase: 1,
                bounceOffsetX: (Math.random() - 0.5) * 20, // Случайное направление по X
                bounceOffsetY: -15, // Первый отскок вверх
              };
            }
            
            return {
              ...item,
              animY: newY,
            };
          }
          
          // Фаза 2: Отскоки (2-3 отскока)
          if (item.bouncePhase >= 1 && item.bouncePhase <= 3) {
            let newBounceOffsetY = item.bounceOffsetY + 1; // Гравитация для отскока
            let newBounceOffsetX = item.bounceOffsetX;
            
            // Если отскок достиг "земли" (Y = 0)
            if (newBounceOffsetY >= 0) {
              newBounceOffsetY = 0;
              // Переход к следующей фазе отскока или завершение
              if (item.bouncePhase < 3) {
                // Следующий отскок с меньшей амплитудой
                return {
                  ...item,
                  bouncePhase: item.bouncePhase + 1,
                  bounceOffsetX: (Math.random() - 0.5) * (20 / item.bouncePhase),
                  bounceOffsetY: -15 / item.bouncePhase,
                };
              } else {
                // Завершение анимации
                return {
                  ...item,
                  isFalling: false,
                  bouncePhase: 0,
                  bounceOffsetX: 0,
                  bounceOffsetY: 0,
                };
              }
            }
            
            return {
              ...item,
              bounceOffsetX: newBounceOffsetX,
              bounceOffsetY: newBounceOffsetY,
            };
          }
          
          return item;
        });
        
        return {
          ...prev,
          items: updatedItems,
        };
      });
      
      if (needsAnimation) {
        animationFrameRef.current = requestAnimationFrame(animateItems);
      }
    };
    
    // Запускаем анимацию через небольшой延迟 чтобы DOM успел отрендериться
    const timeoutId = setTimeout(() => {
      animationFrameRef.current = requestAnimationFrame(animateItems);
    }, 50);
    
    return () => {
      clearTimeout(timeoutId);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.items.length]);

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
