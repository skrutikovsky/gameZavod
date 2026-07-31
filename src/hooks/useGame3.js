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
      items.push({
        id: `item-${itemId++}`,
        type: typeIdx + 1,
        x: Math.random() * 80 + 10, // 10-90% ширины правой части
        y: Math.random() * 80 + 10, // 10-90% высоты
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

  const startGame = useCallback(() => {
    const initialItems = generateItems();
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

  const handleDragEnd = useCallback((dropZone) => {
    if (!draggedItemRef.current) return;

    const item = draggedItemRef.current;
    const originalPos = originalPositionRef.current;

    setGameState(prev => {
      // Если dropped в соответствующую коробку
      if (dropZone === 'box' && item.type === dropZone) {
        const newBoxes = prev.boxes.map(box => {
          if (box.type === item.type) {
            const newCount = box.count + 1;
            if (newCount >= MAX_BOX_COUNT) {
              // Коробка заполнена - начисляем очки и сбрасываем счетчик
              return {
                ...box,
                count: 0,
              };
            }
            return {
              ...box,
              count: newCount,
            };
          }
          return box;
        });

        const pointsEarned = prev.boxes.find(b => b.type === item.type)?.points || 0;
        const boxWasFull = prev.boxes.find(b => b.type === item.type)?.count === MAX_BOX_COUNT - 1;

        // Удаляем предмет из списка
        const newItems = prev.items.filter(i => i.id !== item.id);

        return {
          ...prev,
          score: boxWasFull ? prev.score + pointsEarned : prev.score,
          boxes: newBoxes,
          items: newItems,
          draggedItem: null,
        };
      }

      // Если dropped на доску-плоскость - предмет остается там где его бросили
      if (dropZone === 'board') {
        const newItems = prev.items.map(i => {
          if (i.id === item.id) {
            // Вычисляем новые координаты относительно правой части
            return {
              ...i,
              x: i.x,
              y: i.y,
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

  // Эффект для проверки завершения раунда
  useEffect(() => {
    if (gameState.items.length === 0) {
      setTimeout(() => {
        const newItems = generateItems();
        setGameState(prev => ({
          ...prev,
          items: newItems,
        }));
      }, 500);
    }
  }, [gameState.items.length]);

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
