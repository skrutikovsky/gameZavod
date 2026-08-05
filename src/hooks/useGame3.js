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

let currentRoundItemCount = 12; // Начальное количество предметов
let roundNumber = 0; // Номер раунда для увеличения количества предметов

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

// Генерация предметов с заданными пропорциями
const generateItems = (startAboveScreen = false) => {
  const items = [];
  
  // Увеличиваем количество предметов на 2 каждый раунд
  roundNumber++;
  if (roundNumber > 1) {
    currentRoundItemCount = Math.min(60, 12 + (roundNumber - 1) * 2);
  }
  
  const counts = [
    Math.round(currentRoundItemCount * 0.03), // тип 1 - 3%
    Math.round(currentRoundItemCount * 0.07), // тип 2 - 7%
    Math.round(currentRoundItemCount * 0.15), // тип 3 - 15%
    Math.round(currentRoundItemCount * 0.20), // тип 4 - 20%
    Math.round(currentRoundItemCount * 0.25), // тип 5 - 25%
    Math.round(currentRoundItemCount * 0.30), // тип 6 - 30%
  ];

  // Корректировка чтобы сумма была ровно currentRoundItemCount
  let total = counts.reduce((a, b) => a + b, 0);
  if (total < currentRoundItemCount) {
    counts[5] += currentRoundItemCount - total;
  } else if (total > currentRoundItemCount) {
    counts[5] -= total - currentRoundItemCount;
  }

  let itemId = 0;
  for (let typeIdx = 0; typeIdx < counts.length; typeIdx++) {
    for (let i = 0; i < counts[typeIdx]; i++) {
      // Ограничиваем targetY пределами 15-75% чтобы предметы падали в центральной области доски
      // Это предотвращает улетание предметов за края при отскоках
      const targetY = Math.random() * 60 + 15; // 15-75% высоты
      const targetX = Math.random() * 70 + 15; // 15-85% ширины
      
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
    round: 0,
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
    // Сбрасываем счетчик раундов и количество предметов при старте новой игры
    roundNumber = 0;
    currentRoundItemCount = 12;
    
    const initialItems = generateItems(true); // true = предметы появляются выше экрана

    setGameState(prev => ({
      ...prev,
      items: initialItems,
      score: 0,
      round: 0,
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
            // Лимит убран - коробка заполняется бесконечно, очки начисляются за каждый предмет
            pointsEarned = b.points;
            return {
              ...b,
              count: newCount,
            };
          }
          return b;
        });

        // Удаляем предмет из списка
        const newItems = prev.items.filter(i => i.id !== item.id);

        const newState = {
          ...prev,
          score: prev.score + pointsEarned,
          boxes: newBoxes,
          items: newItems,
          draggedItem: null,
        };

        // Проверяем завершение раунда после удаления предмета
        if (newItems.length === 0 && !prev.isRoundComplete) {
          const newItemsGenerated = generateItems(true);
          return {
            ...newState,
            items: newItemsGenerated,
            round: prev.round + 1, // Увеличиваем номер раунда
            isRoundComplete: false, // Сбрасываем флаг для следующего раунда
          };
        }

        return newState;
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
          const itemSizePx = 96; // w-24 h-24 = 96px (увеличено в 1.5 раза)
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

            // Проверяем достигли ли поверхности или пролетели ниже неё
            if (distance < 0.5 || newItem.y >= newItem.targetY) {
              // Достигли поверхности - начинаем отскок
              newItem.y = newItem.targetY;
              newItem.x = newItem.targetX;
              newItem.isFalling = false;
              
              // Убедимся что targetY в пределах доски (5-90%)
              // Если targetY вышел за пределы, корректируем его
              if (newItem.targetY < 5) newItem.targetY = 5 + Math.random() * 10;
              if (newItem.targetY > 90) newItem.targetY = 80 + Math.random() * 10;
              newItem.y = newItem.targetY;
              
              // Инициализируем физику отскока
              // Вертикальная скорость вверх (отскок) - уменьшена для менее дугообразной траектории
              newItem.velocityY = -(Math.random() * 0.25 + 0.2); // -0.2 до -0.45
              // Горизонтальная скорость (случайное направление) - ограничена чтобы не улетать за экран
              newItem.velocityX = (Math.random() - 0.5) * 0.8; // -0.4 до 0.4 (уменьшено с 1.6)
              newItem.bounceCount = 0;
              newItem.maxBounces = Math.floor(Math.random() * 4) + 2; // 2-5 отскоков
            } else {
              // Падение строго вниз с ускорением (физически корректно)
              // Ограничиваем максимальную скорость чтобы предмет не "перепрыгнул" поверхность
              const gravity = 0.01275; // 0.015 * 0.85 = 0.01275 (ускорение свободного падения)
              newItem.fallSpeed = (newItem.fallSpeed || 0) + gravity;
              // Ограничиваем скорость чтобы не перепрыгнуть targetY
              const maxSpeed = Math.max(0.5, Math.abs(newItem.targetY - newItem.y) * 0.3);
              const speed = Math.min(newItem.fallSpeed, maxSpeed, 1.02);
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
            
            // Проверка границ по X (левая и правая стены)
            if (newItem.x <= 5) {
              newItem.x = 5;
              newItem.velocityX = Math.abs(newItem.velocityX) * 0.8; // Отскок вправо
            } else if (newItem.x >= 95) {
              newItem.x = 95;
              newItem.velocityX = -Math.abs(newItem.velocityX) * 0.8; // Отскок влево
            }
            
            // Проверка границ по Y - жёсткое ограничение чтобы предметы не улетали за экран
            // Нижняя граница (не даем улететь за экран) - проверяем ПЕРЕД обработкой отскоков от поверхности
            if (newItem.y >= 85) {
              newItem.y = 85;
              // Если скорость всё ещё направлена вниз - гасим её и делаем небольшой отскок
              if (newItem.velocityY > 0) {
                newItem.velocityY = -Math.abs(newItem.velocityY) * 0.4;
              }
              newItem.bounceCount++;
              // Если уже много отскоков или скорость маленькая - останавливаем предмет
              if (newItem.bounceCount >= newItem.maxBounces || Math.abs(newItem.velocityY) < 0.15) {
                newItem.velocityX = 0;
                newItem.velocityY = 0;
              }
            }
            // Верхняя граница (если вдруг улетит вверх)
            else if (newItem.y <= 5) {
              newItem.y = 5;
              newItem.velocityY = Math.abs(newItem.velocityY) * 0.8; // Отскок вниз
            }
            // Проверка на достижение "поверхности" (targetY) для инициации отскоков
            // Проверяем только если предмет ещё не достиг нижней границы и движется вниз
            // Это предотвращает двойную обработку когда предмет уже у нижней границы
            // Также проверяем что targetY в пределах доски (5-90%)
            else if (newItem.y >= newItem.targetY && newItem.velocityY > 0) {
              newItem.y = newItem.targetY;
              
              if (newItem.bounceCount === 0) {
                // Первый контакт с поверхностью - начинаем отскоки
                newItem.bounceCount = 1;
                // Высота отскока зависит от номера отскока
                const bounceHeightMultiplier = 0.5;
                newItem.velocityY = -Math.abs(newItem.velocityY || 0.3) * bounceDamping * bounceHeightMultiplier;
                // Добавляем немного случайности к горизонтальной скорости при отскоке
                newItem.velocityX = newItem.velocityX * 0.9 + (Math.random() - 0.5) * 0.3;
              } else if (newItem.bounceCount < newItem.maxBounces && Math.abs(newItem.velocityY) > 0.15) {
                // Продолжаем отскоки
                const bounceHeightMultiplier = 1.0;
                newItem.velocityY = -Math.abs(newItem.velocityY) * bounceDamping * bounceHeightMultiplier;
                newItem.velocityX = newItem.velocityX * 0.9 + (Math.random() - 0.5) * 0.3;
                newItem.bounceCount++;
              } else {
                // Завершаем отскоки - предмет останавливается
                newItem.velocityX = 0;
                newItem.velocityY = 0;
              }
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
    ITEM_TYPES,
  };
};
