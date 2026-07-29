import React from 'react';

export function Modal({ title, message, children }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]">
      <div
        className="bg-white/95 p-12 rounded-3xl text-center max-w-lg w-[90%] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-4xl font-bold text-gray-800 mb-4">{title}</h2>
        {message && (
          <p className="text-xl text-gray-600 mb-8 whitespace-pre-line">{message}</p>
        )}
        {children}
      </div>
    </div>
  );
}

export default Modal;
