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
const generateItems = (startAboveScreen = false) => {
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
      
      // Все предметы начинают падение с одинаковой высоты над экраном (-30%)
      // чтобы достигать поверхности примерно одновременно
      const startY = startAboveScreen ? -30 : targetY;
      
      items.push({
        id: `item-${itemId++}`,
        type: typeIdx + 1,
        x: startAboveScreen ? targetX : targetX, // X позиция соответствует целевой
        y: startY,
        targetY: targetY, // Целевая позиция Y для анимации падения
        targetX: targetX, // Целевая позиция X для анимации падения
        isFalling: startAboveScreen, // Флаг что предмет падает
        bounceCount: 0, // Количество отскоков
        maxBounces: 0, // Максимальное количество отскоков
        bounceTargetX: null, // Целевая X для отскока
        bounceTargetY: null, // Целевая Y для отскока
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
  const animationFrameRef = useRef(null); // Ref для requestAnimationFrame

  const startGame = useCallback(() => {
    const initialItems = generateItems(true); // true = предметы появляются выше экрана

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
          const itemSizePx = 72; // w-18 h-18 = 72px (увеличено в 1.5 раза)
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

  // Анимация падения предметов с физическими отскоками
  useEffect(() => {
    const animateItems = () => {
      setGameState(prev => {
        let hasActiveItems = false;
        const newItems = prev.items.map(item => {
          // Предметы не участвующие в анимации пропускаем
          if (!item.isFalling && !item.velocityX) {
            return item;
          }

          hasActiveItems = true;
          let newItem = { ...item };

          // Фаза 1: Падение (только вертикальное движение с ускорением)
          if (newItem.isFalling) {
            const dy = newItem.targetY - newItem.y;
            const distance = Math.abs(dy);

            if (distance < 0.5) {
              // Достигли поверхности - начинаем отскок
              newItem.y = newItem.targetY;
              newItem.x = newItem.targetX;
              newItem.isFalling = false;
              
              // Инициализируем физику отскока
              // Вертикальная скорость вверх (отскок) - уменьшена для менее дугообразной траектории
              newItem.velocityY = -(Math.random() * 0.25 + 0.2); // -0.2 до -0.45
              // Горизонтальная скорость (случайное направление) - увеличена для менее дугообразной траектории
              newItem.velocityX = (Math.random() - 0.5) * 1.6; // -0.8 до 0.8
              newItem.bounceCount = 0;
              newItem.maxBounces = Math.floor(Math.random() * 4) + 2; // 2-5 отскоков
            } else {
              // Падение строго вниз с ускорением (физически корректно)
              // Уменьшено на 15% от предыдущей скорости
              const gravity = 0.01275; // 0.015 * 0.85 = 0.01275 (ускорение свободного падения)
              newItem.fallSpeed = (newItem.fallSpeed || 0) + gravity;
              const speed = Math.min(newItem.fallSpeed, 1.02); // 1.2 * 0.85 = 1.02 (Ограничение максимальной скорости)
              newItem.y += speed;
            }
          } 
          // Фаза 2: Физические отскоки
          else if (newItem.velocityY !== undefined) {
            const gravity = 0.03; // Гравитация (уменьшена для менее дугообразной траектории)
            const friction = 0.96; // Трение воздуха
            const bounceDamping = 0.65; // Затухание отскока
            
            // Применяем гравитацию
            newItem.velocityY += gravity;
            
            // Применяем трение к горизонтальной скорости
            newItem.velocityX *= friction;
            
            // Обновляем позицию
            newItem.x += newItem.velocityX;
            newItem.y += newItem.velocityY;
            
            // Проверка на достижение "поверхности" (targetY)
            if (newItem.y >= newItem.targetY) {
              newItem.y = newItem.targetY;
              newItem.bounceCount++;
              
              if (newItem.bounceCount >= newItem.maxBounces || Math.abs(newItem.velocityY) < 0.1) {
                // Завершаем отскоки - предмет останавливается
                newItem.velocityX = 0;
                newItem.velocityY = 0;
              } else {
                // Отскок от поверхности - высота зависит от номера отскока
                const bounceHeightMultiplier = newItem.bounceCount === 1 ? 0.5 : 1.0;
                newItem.velocityY = -Math.abs(newItem.velocityY) * bounceDamping * bounceHeightMultiplier;
                // Добавляем немного случайности к горизонтальной скорости при отскоке
                newItem.velocityX = newItem.velocityX * 0.9 + (Math.random() - 0.5) * 0.3;
              }
            }
            
            // Проверка границ по X (левая и правая стены)
            if (newItem.x <= 5) {
              newItem.x = 5;
              newItem.velocityX = Math.abs(newItem.velocityX) * 0.8; // Отскок вправо
            } else if (newItem.x >= 95) {
              newItem.x = 95;
              newItem.velocityX = -Math.abs(newItem.velocityX) * 0.8; // Отскок влево
            }
            
            // Проверка границ по Y (нижняя граница - не даем улететь за экран)
            if (newItem.y >= 95) {
              newItem.y = 95;
              newItem.velocityY = -Math.abs(newItem.velocityY) * 0.5; // Отскок вверх
            }
            // Проверка границ по Y (верхняя стена, если вдруг улетит)
            if (newItem.y <= 5) {
              newItem.y = 5;
              newItem.velocityY = Math.abs(newItem.velocityY) * 0.8; // Отскок вниз
            }
          }

          return newItem;
        });

        return hasActiveItems ? { ...prev, items: newItems } : prev;
      });

      animationFrameRef.current = requestAnimationFrame(animateItems);
    };

    animationFrameRef.current = requestAnimationFrame(animateItems);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Проверка завершения раунда
  const checkRoundComplete = useCallback(() => {
    setGameState(prev => {
      if (prev.items.length === 0 && !prev.isRoundComplete) {
        // Все предметы разложены - спавним новые
        const newItems = generateItems(true); // true = предметы появляются выше экрана
        return {
          ...prev,
          items: newItems,
          isRoundComplete: true,
        };
      }
      return prev;
    });
  }, []);

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
