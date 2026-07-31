import React, { useEffect, useRef, useCallback } from 'react';
import { useGame3 } from '../../hooks/useGame3';

const Game3 = ({ level, onGameOver, onBack, onLevelComplete }) => {
  const {
    gameState,
    startGame,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    ITEM_TYPES,
    MAX_BOX_COUNT,
  } = useGame3();

  const gameContainerRef = useRef(null);
  const leftPanelRef = useRef(null);
  const rightPanelRef = useRef(null);
  const draggedItemElementRef = useRef(null);

  useEffect(() => {
    startGame();
  }, [startGame]);

  // Глобальные обработчики drag&drop
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (gameState.draggedItem) {
        handleDragMove(e);
      }
    };

    const handleMouseUp = () => {
      if (gameState.draggedItem) {
        // Определяем зону сброса
        const dragPos = gameState.dragPosition;
        const leftRect = leftPanelRef.current?.getBoundingClientRect();
        const rightRect = rightPanelRef.current?.getBoundingClientRect();

        let dropZone = null;

        // Проверяем попадание в левую панель (коробки)
        if (leftRect && 
            dragPos.x >= leftRect.left && 
            dragPos.x <= leftRect.right && 
            dragPos.y >= leftRect.top && 
            dragPos.y <= leftRect.bottom) {
          // Определяем в какую именно коробку попали
          const boxElements = leftPanelRef.current?.querySelectorAll('[data-box-type]');
          if (boxElements) {
            boxElements.forEach(boxEl => {
              const boxRect = boxEl.getBoundingClientRect();
              const boxType = parseInt(boxEl.getAttribute('data-box-type'));
              if (
                dragPos.x >= boxRect.left && 
                dragPos.x <= boxRect.right && 
                dragPos.y >= boxRect.top && 
                dragPos.y <= boxRect.bottom
              ) {
                dropZone = boxType;
              }
            });
          }
        }

        // Проверяем попадание в правую панель (доска-плоскость)
        if (rightRect && 
            dragPos.x >= rightRect.left && 
            dragPos.x <= rightRect.right && 
            dragPos.y >= rightRect.top && 
            dragPos.y <= rightRect.bottom) {
          dropZone = 'board';
        }

        handleDragEnd(dropZone);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameState.draggedItem, gameState.dragPosition, handleDragMove, handleDragEnd]);

  // Обработчик начала перетаскивания
  const onItemDragStart = useCallback((item, e) => {
    e.preventDefault();
    handleDragStart(item, e);
    
    // Создаем визуальный элемент для перетаскивания
    const element = e.target.cloneNode(true);
    element.style.position = 'fixed';
    element.style.pointerEvents = 'none';
    element.style.zIndex = '1000';
    element.style.opacity = '0.8';
    document.body.appendChild(element);
    draggedItemElementRef.current = element;

    const updateDragElement = (clientX, clientY) => {
      if (draggedItemElementRef.current) {
        draggedItemElementRef.current.style.left = `${clientX - 25}px`;
        draggedItemElementRef.current.style.top = `${clientY - 25}px`;
      }
    };

    const onMouseMove = (moveEvent) => {
      const clientX = moveEvent.clientX || moveEvent.touches?.[0]?.clientX || 0;
      const clientY = moveEvent.clientY || moveEvent.touches?.[0]?.clientY || 0;
      updateDragElement(clientX, clientY);
    };

    const onMouseUpHandler = () => {
      if (draggedItemElementRef.current) {
        document.body.removeChild(draggedItemElementRef.current);
        draggedItemElementRef.current = null;
      }
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUpHandler);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUpHandler);
  }, [handleDragStart]);

  // Получение иконки для типа предмета
  const getItemIcon = (typeId) => {
    const icons = {
      1: '🔌', // чип
      2: '⚡', // предохранитель
      3: '💡', // лампочка
      4: '🌀', // пружина
      5: '🔩', // гайка
      6: '🔨', // болт
    };
    return icons[typeId] || '❓';
  };

  // Получение цвета для типа предмета
  const getItemColor = (typeId) => {
    const colors = {
      1: 'bg-blue-500',
      2: 'bg-red-500',
      3: 'bg-yellow-400',
      4: 'bg-purple-500',
      5: 'bg-gray-500',
      6: 'bg-orange-500',
    };
    return colors[typeId] || 'bg-gray-400';
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={gameContainerRef}
      className="game-container relative w-full h-screen overflow-hidden flex"
    >
      {/* Левая панель - коробки (1/3 ширины) */}
      <div 
        ref={leftPanelRef}
        className="h-full bg-gradient-to-b from-indigo-900 to-indigo-700 p-4 flex flex-col justify-around"
        style={{ width: '33.33%' }}
      >
        <h2 className="text-white text-xl font-bold text-center mb-2">Коробки</h2>
        {gameState.boxes.map((box) => (
          <div
            key={box.type}
            data-box-type={box.type}
            className={`relative ${getItemColor(box.type)} rounded-lg p-3 shadow-lg border-4 border-white/30 transition-all hover:scale-105`}
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl">{getItemIcon(box.type)}</span>
              <div className="text-right">
                <div className="text-white text-sm font-semibold">{box.name}</div>
                <div className="text-white text-xs">{box.points} очков</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-white text-lg font-bold">
                {box.count} / {MAX_BOX_COUNT}
              </div>
              {/* Прогресс бар */}
              <div className="flex-1 ml-3 h-3 bg-black/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-400 transition-all duration-300"
                  style={{ width: `${(box.count / MAX_BOX_COUNT) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        
        {/* Общий счет */}
        <div className="mt-4 bg-white/20 backdrop-blur-md rounded-lg p-3 text-center">
          <div className="text-white text-lg">Счет: {gameState.score}</div>
        </div>
      </div>

      {/* Правая панель - доска-плоскость (2/3 ширины) */}
      <div 
        ref={rightPanelRef}
        className="h-full bg-gradient-to-b from-slate-800 to-slate-600 p-4 relative"
        style={{ width: '66.67%' }}
      >
        <h2 className="text-white text-xl font-bold mb-4">Доска предметов</h2>
        <div className="text-white/70 text-sm mb-2">
          Предметов на доске: {gameState.items.length}
        </div>
        
        {/* Предметы на доске */}
        {gameState.items.map((item) => (
          <div
            key={item.id}
            className={`absolute w-12 h-12 ${getItemColor(item.type)} rounded-lg shadow-md cursor-grab active:cursor-grabbing flex items-center justify-center text-2xl select-none border-2 border-white/50 hover:scale-110 transition-transform`}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onMouseDown={(e) => onItemDragStart(item, e)}
            onTouchStart={(e) => onItemDragStart(item, e)}
          >
            {getItemIcon(item.type)}
          </div>
        ))}
      </div>

      {/* Кнопка назад */}
      <button
        onClick={onBack}
        className="absolute top-5 left-5 z-50 w-12 h-12 bg-white/30 hover:bg-white/50 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all"
      >
        ←
      </button>
    </div>
  );
};

export default Game3;
