import { useState, useEffect, useCallback, useRef } from 'react';

const BOX_SIZE = 120; // Размер коробки в пикселях (увеличен для квадратной формы)
const HAND_POSITION_Y = 78; // Позиция руки в процентах от высоты экрана
const HAND_POSITION_X = 25; // Позиция руки по горизонтали (слева) в %
const INITIAL_LIVES = 3;
const BASE_CONVEYOR_SPEED = 0.25; // Базовая скорость конвейера
const BELT_WIDTH_PERCENT = 25; // Ширина конвейера в % от экрана
const MAX_BOXES_ON_BELT = 8; // Максимальное количество коробок на ленте
export const HAND_STOP_LINE_Y = 78; // Позиция линии остановки (в процентах)
const LEVER_POSITION_X = 25; // Позиция рычага по горизонтали (слева) в %
const CONTAINER_Y = 88; // Позиция контейнера в процентах
// Невидимая линия регистрации - на одну высоту коробки ниже контейнера
// Вычисляется динамически в updateBoxes где известен screenHeight

export function useGame2() {
  const [gameState, setGameState] = useState({
    isRunning: false,
    score: 0,
    lives: INITIAL_LIVES,
    boxesFixed: 0,
    containersClosed: 0,
    gameTime: 0,
    multiplier: 1,
    comboCount: 0,
    maxMultiplier: 1,
    conveyorSpeed: BASE_CONVEYOR_SPEED,
    handActive: false,
    boxes: [],
    container: null,
    containerSpawning: false,
    levelCompleteShown: false
  });
  
  const boxesRef = useRef([]);
  const gameStateRef = useRef(null);
  const gameStartTimeRef = useRef(0);
  const conveyorSpeedRef = useRef(BASE_CONVEYOR_SPEED);
  const lastSpawnTimeRef = useRef(0);
  const containerCapacityRef = useRef(5);
  const containerCountRef = useRef(0);
  const handActiveRef = useRef(false); // Реф для мгновенной реакции руки
  const containerChainedCountRef = useRef(0); // Счетчик цепочки коробок с isChained=true
  const containerErrorAnimRef = useRef(false); // Флаг анимации ошибки контейнера
  const containerErrorAnimStartTimeRef = useRef(0); // Время начала анимации ошибки
  const lastAcceptedBoxYRef = useRef(null); // Y-позиция последней коробки принятой контейнером

  // Обновляем ref при изменении состояния
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const resetGame = useCallback(() => {
    boxesRef.current = [];
    gameStartTimeRef.current = 0;
    conveyorSpeedRef.current = BASE_CONVEYOR_SPEED;
    lastSpawnTimeRef.current = 0;
    containerCapacityRef.current = 5;
    containerCountRef.current = 0;
    handActiveRef.current = false; // Сбрасываем состояние руки
    containerChainedCountRef.current = 0;
    containerErrorAnimRef.current = false;
    containerErrorAnimStartTimeRef.current = 0;
    lastAcceptedBoxYRef.current = null; // Сбрасываем позицию последней коробки

    setGameState({
      isRunning: false,
      score: 0,
      lives: INITIAL_LIVES,
      boxesFixed: 0,
      containersClosed: 0,
      gameTime: 0,
      multiplier: 1,
      comboCount: 0,
      maxMultiplier: 1,
      conveyorSpeed: BASE_CONVEYOR_SPEED,
      handActive: false,
      boxes: [],
      container: null,
      containerSpawning: false,
      levelCompleteShown: false
    });
  }, []);

  const setHandActive = useCallback((active) => {
    handActiveRef.current = active; // Мгновенно обновляем реф
    setGameState(prev => ({
      ...prev,
      handActive: active
    }));
  }, []);

  const spawnBox = useCallback(() => {
    const currentState = gameStateRef.current;
    if (!currentState) return null;

    // Проверяем лимит коробок на ленте
    const screenHeightPx = window.innerHeight || 800;
    const boxHeightPercent = (BOX_SIZE / screenHeightPx) * 100;
    const boxesOnBelt = boxesRef.current.filter(box => {
      const boxBottom = box.y + boxHeightPercent;
      return boxBottom < 90; // Коробка считается на ленте если её низ выше зоны контейнера
    }).length;

    if (boxesOnBelt >= MAX_BOXES_ON_BELT) {
      return null; // Не спавним новую коробку если лимит достигнут
    }

    const newBox = {
      id: Date.now() + Math.random(),
      y: -20,
      stopped: false,
      isChained: false // Флаг цепочки: true если коробка соприкасается с другой
    };

    boxesRef.current = [...boxesRef.current, newBox];

    setGameState(prev => ({
      ...prev,
      boxes: boxesRef.current
    }));

    return newBox;
  }, []);

  // Функция для генерации случайного количества предметов в контейнере (от 2 до 7)
  const generateContainerCapacity = useCallback(() => {
    return Math.floor(Math.random() * 6) + 2; // Случайное число от 2 до 7
  }, []);

  const updateBoxes = useCallback(() => {
    const currentState = gameStateRef.current;
    if (!currentState || !currentState.isRunning) return;

    let livesLost = 0;
    let boxesFixedThisUpdate = 0;
    let scoreGained = 0;
    let newComboCount = currentState.comboCount;
    let newMultiplier = currentState.multiplier;
    let currentSpeed = conveyorSpeedRef.current;
    
    // Позиция невидимой линии остановки (стена от руки)
    const handStopLineY = HAND_STOP_LINE_Y;
    // Используем ref для мгновенной проверки состояния руки
    const isHandBlocking = handActiveRef.current;

    // Вычисляем высоту коробки в процентах от высоты экрана
    const screenHeightPx = window.innerHeight || 800;
    const boxHeightPercent = (BOX_SIZE / screenHeightPx) * 100;

    // Сортируем коробки по позиции Y (сверху вниз)
    boxesRef.current.sort((a, b) => a.y - b.y);
    
    // Сбрасываем статус stopped у всех коробок
    boxesRef.current.forEach(box => {
      box.stopped = false;
    });
    
    // Если рука активна - линия становится физической преградой
    if (isHandBlocking) {
      // Проходим по коробкам снизу вверх и проверяем столкновения
      for (let i = boxesRef.current.length - 1; i >= 0; i--) {
        const box = boxesRef.current[i];
        const boxBottom = box.y + boxHeightPercent;
        
        // Коробка останавливается ТОЛЬКО если её нижняя граница достигает линии остановки
        // При этом коробка должна быть полностью ВЫШЕ или на линии (не ниже)
        // Если любая часть коробки уже НИЖЕ линии - она не может быть остановлена
        if (boxBottom <= handStopLineY) {
          // Коробка ещё выше линии - продолжаем падение пока не достигнет линии
          // Проверяем достигла ли нижняя граница линии
          if (boxBottom >= handStopLineY - currentSpeed) {
            // Нижняя граница достигла линии - останавливаем коробку
            box.y = handStopLineY - boxHeightPercent;
            box.stopped = true;
          }
        }
        // Если коробка полностью ниже линии (box.y > handStopLineY) - она уже прошла линию 
        // и НЕ должна останавливаться, продолжит падение к контейнеру
        
        // Проверяем столкновение с коробкой ниже
        // Важно: коробка останавливается от другой коробки только если она сама ещё не прошла линию
        // и нижняя коробка тоже находится выше линии (её низ выше линии остановки)
        if (i < boxesRef.current.length - 1 && !box.stopped) {
          const boxBelow = boxesRef.current[i + 1];
          const boxBelowBottom = boxBelow.y + boxHeightPercent;
          // Если коробка ниже остановлена И её низ выше или на линии остановки, проверяем столкновение с ней
          if (boxBelow.stopped && boxBelowBottom <= handStopLineY) {
            const boxBelowTop = boxBelow.y;
            const currentBoxBottom = box.y + boxHeightPercent;
            
            // Если коробка коснулась коробки ниже
            if (currentBoxBottom >= boxBelowTop) {
              box.y = boxBelowTop - boxHeightPercent;
              box.stopped = true;
            }
          }
        }
      }
    }
    
    // Двигаем все не остановленные коробки
    boxesRef.current.forEach(box => {
      if (!box.stopped) {
        box.y += currentSpeed;
      }
    });

    // Вычисляем флаг isChained для всех коробок
    // isChained = true если у коробки есть соприкосновение с ДРУГОЙ коробкой (верхней ИЛИ нижней)
    // Это вычисляется на каждом тике чтобы отслеживать текущее состояние цепочки
    // Используем жесткий хитбокс (1 пиксель) для точного определения касания
    boxesRef.current.forEach((box, index) => {
      box.isChained = false;
      
      // Проверяем соприкосновение с коробкой выше
      if (index > 0) {
        const boxAbove = boxesRef.current[index - 1];
        const boxAboveBottom = boxAbove.y + boxHeightPercent;
        const currentBoxTop = box.y;
        // Жесткая проверка касания (разница <= 1 пиксель)
        if (Math.abs(boxAboveBottom - currentBoxTop) <= 1) {
          box.isChained = true;
        }
      }
      
      // Проверяем соприкосновение с коробкой ниже
      if (index < boxesRef.current.length - 1) {
        const boxBelow = boxesRef.current[index + 1];
        const boxBelowTop = boxBelow.y;
        const currentBoxBottom = box.y + boxHeightPercent;
        // Жесткая проверка касания (разница <= 1 пиксель)
        if (Math.abs(currentBoxBottom - boxBelowTop) <= 1) {
          box.isChained = true;
        }
      }
    });

    // isInChainGroup = true ТОЛЬКО для коробок которые являются частью непрерывной цепочки
    // и количество которых НЕ превышает capacity текущего контейнера
    // Это ключевое изменение: мы ограничиваем количество коробок с флагом до требуемого контейнером
    boxesRef.current.forEach((box, index) => {
      box.isInChainGroup = false;
    });
    
    // Если есть активный контейнер, ограничиваем длину цепочки его capacity
    const maxChainLength = currentState.container ? currentState.container.capacity : 2;
    
    // Находим все группы соприкасающихся коробок
    const groups = [];
    let currentGroup = [];
    
    for (let i = 0; i < boxesRef.current.length; i++) {
      if (currentGroup.length === 0) {
        currentGroup = [i];
      } else {
        // Проверяем соприкасается ли текущая коробка с последней в группе
        const lastIdx = currentGroup[currentGroup.length - 1];
        const lastBox = boxesRef.current[lastIdx];
        const currentBox = boxesRef.current[i];
        const lastBoxBottom = lastBox.y + boxHeightPercent;
        const currentBoxTop = currentBox.y;
        
        // Жесткая проверка касания (разница <= 1 пиксель)
        if (Math.abs(lastBoxBottom - currentBoxTop) <= 1) {
          // Соприкасается - добавляем в группу
          currentGroup.push(i);
        } else {
          // Не соприкасается - завершаем текущую группу и начинаем новую
          if (currentGroup.length > 0) {
            groups.push([...currentGroup]);
          }
          currentGroup = [i];
        }
      }
    }
    // Добавляем последнюю группу
    if (currentGroup.length > 0) {
      groups.push([...currentGroup]);
    }
    
    // Теперь устанавливаем isInChainGroup = true только для НИЖНИХ maxChainLength коробок в каждой группе
    // Счет ведется с нижней коробки (ближайшей к контейнеру), т.е. с конца группы
    groups.forEach(group => {
      if (group.length >= 2) {
        // Это цепочка из 2+ коробок - помечаем только нижние maxChainLength коробок
        const boxesToMark = Math.min(group.length, maxChainLength);
        // Берем коробки с конца группы (нижние = ближе к контейнеру)
        for (let i = 0; i < boxesToMark; i++) {
          const boxIndex = group[group.length - 1 - i]; // Берем с конца
          boxesRef.current[boxIndex].isInChainGroup = true;
        }
      }
    });

    // Спавн контейнера когда нет активного (только если рука не блокирует)
    if (!isHandBlocking && !currentState.container && !currentState.containerSpawning) {
      setGameState(prev => ({
        ...prev,
        containerSpawning: true
      }));

      setTimeout(() => {
        containerCountRef.current = 0;
        containerChainedCountRef.current = 0; // Сбрасываем счетчик цепочки при новом контейнере
        lastAcceptedBoxYRef.current = null; // Сбрасываем позицию последней коробки
        // Генерируем случайную вместимость контейнера от 2 до 7
        const newCapacity = generateContainerCapacity();
        setGameState(prev => ({
          ...prev,
          containerSpawning: false,
          container: {
            y: 88,
            count: 0,
            capacity: newCapacity
          }
        }));
      }, 1000);
    }

    // Проверяем коробки, достигшие контейнера
    // Используем невидимую линию регистрации ниже контейнера
    // Коробки регистрируются только когда пересекают эту линию
    // Линия находится на одну высоту коробки ниже дна контейнера
    const registerLineY = CONTAINER_Y + boxHeightPercent;
    const boxesReachedContainer = [];
    const boxesToRemove = [];
    
    // Сначала обновляем флаги для коробок которые пересекли линию регистрации
    boxesRef.current.forEach(box => {
      const boxCenterY = box.y + boxHeightPercent / 2;
      
      if (boxCenterY >= registerLineY && !box.markedForDeletion) {
        // Коробка пересекла линию регистрации впервые - помечаем её
        box.markedForDeletion = true;
        box.markedTime = Date.now();
        boxesReachedContainer.push(box);
      } else if (box.markedForDeletion) {
        // Коробка уже помечена - проверяем, пора ли удалить
        if (Date.now() - box.markedTime > 500) {
          boxesToRemove.push(box.id);
        }
      }
    });
    
    // Удаляем коробки которые продержались достаточно долго
    if (boxesToRemove.length > 0) {
      boxesRef.current = boxesRef.current.filter(box => !boxesToRemove.includes(box.id));
    }
    
    // Обрабатываем коробки которые пересекли линию регистрации
    if (boxesReachedContainer.length > 0 && currentState.container && !currentState.containerSpawning) {
      // Ключевое изменение: проверяем что ВСЕ коробки для контейнера идут ОДНОЙ непрерывной цепочкой
      // без разрывов. Если контейнер требует 5 коробок, они должны прийти все сразу одной группой,
      // либо частями но без разрывов между частями.
      
      // Проверяем что в партии нет коробок без связности
      const nonChainedBoxesInBatch = boxesReachedContainer.filter(box => !box.isChained).length;
      
      // Дополнительная проверка: если контейнер уже частично заполнен, новые коробки должны
      // соприкасаться с последними коробками которые уже вошли в контейнер
      let hasGap = false;
      if (containerCountRef.current > 0 && lastAcceptedBoxYRef.current !== null) {
        // Проверяем соприкасается ли первая коробка новой партии с последней принятой
        const firstNewBox = boxesReachedContainer[0];
        const lastAcceptedBottom = lastAcceptedBoxYRef.current + boxHeightPercent;
        const firstNewTop = firstNewBox.y;
        
        // Если нет соприкосновения - значит есть разрыв
        if (Math.abs(lastAcceptedBottom - firstNewTop) > 1) {
          hasGap = true;
        }
      }
      
      if (nonChainedBoxesInBatch > 0 || hasGap) {
        // ОШИБКА: Есть коробки без связности в партии ИЛИ есть разрыв между партиями
        livesLost++;
        containerErrorAnimRef.current = true;
        containerErrorAnimStartTimeRef.current = Date.now();
        
        // Сбрасываем счетчики
        containerCountRef.current = 0;
        containerChainedCountRef.current = 0;
        lastAcceptedBoxYRef.current = null;
        
        // Отправляем контейнер на перезарядку
        setGameState(prev => ({
          ...prev,
          container: null,
          containerSpawning: true
        }));
        
        // Запускаем таймер перезарядки
        setTimeout(() => {
          containerCountRef.current = 0;
          containerChainedCountRef.current = 0;
        lastAcceptedBoxYRef.current = null;
          containerErrorAnimRef.current = false;
          containerErrorAnimStartTimeRef.current = 0;
          const newCapacity = generateContainerCapacity();
          setGameState(prev => ({
            ...prev,
            containerSpawning: false,
            container: {
              y: CONTAINER_Y,
              count: 0,
              capacity: newCapacity
            }
          }));
        }, 1000);
        
        return; // Прерываем обработку
      }
      
      // Проверяем что количество коробок в партии не больше чем требуется
      // Если в контейнер нужно 5 коробок, а пришло 7 связных - это ошибка
      const remainingCapacity = currentState.container.capacity - containerCountRef.current;
      if (boxesReachedContainer.length > remainingCapacity) {
        // ОШИБКА: Пришло слишком много коробок за один раз
        livesLost++;
        containerErrorAnimRef.current = true;
        containerErrorAnimStartTimeRef.current = Date.now();
        
        // Сбрасываем счетчики
        containerCountRef.current = 0;
        containerChainedCountRef.current = 0;
        lastAcceptedBoxYRef.current = null;
        
        // Отправляем контейнер на перезарядку
        setGameState(prev => ({
          ...prev,
          container: null,
          containerSpawning: true
        }));
        
        // Запускаем таймер перезарядки
        setTimeout(() => {
          containerCountRef.current = 0;
          containerChainedCountRef.current = 0;
        lastAcceptedBoxYRef.current = null;
          containerErrorAnimRef.current = false;
          containerErrorAnimStartTimeRef.current = 0;
          const newCapacity = generateContainerCapacity();
          setGameState(prev => ({
            ...prev,
            containerSpawning: false,
            container: {
              y: CONTAINER_Y,
              count: 0,
              capacity: newCapacity
            }
          }));
        }, 1000);
        
        return; // Прерываем обработку
      }
      
      // Все проверки пройдены - увеличиваем счетчик
      boxesReachedContainer.forEach(box => {
        containerChainedCountRef.current++;
        containerCountRef.current++;
        boxesFixedThisUpdate++;
        // Запоминаем Y-позицию последней принятой коробки
        lastAcceptedBoxYRef.current = box.y;
      });
      
      setGameState(prev => ({
        ...prev,
        container: prev.container ? {
          ...prev.container,
          count: containerCountRef.current
        } : null
      }));
      
      // Проверка на заполнение контейнера
      if (containerCountRef.current >= currentState.container.capacity) {
        // УСПЕХ: Контейнер заполнен правильным количеством коробок подряд
        scoreGained += 100 * newMultiplier;
        newComboCount++;
        
        if (newComboCount >= 30) {
          newMultiplier = 2;
        } else if (newComboCount >= 10) {
          newMultiplier = 1.5;
        } else {
          newMultiplier = 1;
        }
        
        setGameState(prev => ({
          ...prev,
          containersClosed: prev.containersClosed + 1,
          container: null,
          containerSpawning: true
        }));
        
        currentSpeed = currentSpeed * 1.02;
        conveyorSpeedRef.current = currentSpeed;
        
        // Запускаем таймер перезарядки
        setTimeout(() => {
          containerCountRef.current = 0;
          containerChainedCountRef.current = 0;
        lastAcceptedBoxYRef.current = null;
          const newCapacity = generateContainerCapacity();
          setGameState(prev => ({
            ...prev,
            containerSpawning: false,
            container: {
              y: CONTAINER_Y,
              count: 0,
              capacity: newCapacity
            }
          }));
        }, 1000);
      }
    } else if (boxesReachedContainer.length > 0 && (!currentState.container || currentState.containerSpawning)) {
      // Коробки достигли контейнера но он на перезарядке - отнимаем жизни за каждую
      livesLost += boxesReachedContainer.length;
      containerChainedCountRef.current = 0;
        lastAcceptedBoxYRef.current = null;
    }

    // Обрабатываем анимацию ошибки контейнера (сбрасываем через 1 секунду)
    const now = Date.now();
    if (containerErrorAnimRef.current && containerErrorAnimStartTimeRef.current) {
      if (now - containerErrorAnimStartTimeRef.current > 1000) {
        containerErrorAnimRef.current = false;
        containerErrorAnimStartTimeRef.current = 0;
      }
    }

    // Обновляем жизни
    let newLives = currentState.lives - livesLost;
    if (newLives < 0) newLives = 0;

    // Обновляем состояние
    setGameState(prev => ({
      ...prev,
      boxes: [...boxesRef.current],
      comboCount: newComboCount,
      multiplier: newMultiplier,
      maxMultiplier: Math.max(prev.maxMultiplier, newMultiplier),
      score: prev.score + scoreGained,
      lives: newLives,
      conveyorSpeed: currentSpeed,
      gameTime: Date.now() - gameStartTimeRef.current,
      containerErrorAnim: containerErrorAnimRef.current
    }));
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    boxesRef.current = [];
    gameStartTimeRef.current = Date.now();

    setGameState(prev => ({
      ...prev,
      isRunning: true,
      boxes: [],
      gameTime: 0,
      conveyorSpeed: BASE_CONVEYOR_SPEED,
      levelCompleteShown: false
    }));
  }, [resetGame]);

  const stopGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: false
    }));
  }, []);

  const completeLevel = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: false
    }));
  }, []);

  return {
    gameState,
    setHandActive,
    spawnBox,
    updateBoxes,
    startGame,
    stopGame,
    completeLevel,
    resetGame,
    BELT_WIDTH_PERCENT,
    HAND_POSITION_Y,
    HAND_POSITION_X,
    LEVER_POSITION_X,
    conveyorSpeedRef,
    lastSpawnTimeRef
  };
}
