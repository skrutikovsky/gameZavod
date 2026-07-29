import React from 'react';

export function Button({ onClick, children, disabled = false, variant = 'primary', className = '' }) {
  const baseStyles = "px-6 py-4 rounded-xl text-lg font-bold cursor-pointer transition-all duration-300 shadow-lg border-none w-full";

  const variants = {
    primary: "bg-blue-500 text-white hover:bg-blue-600 hover:-translate-y-0.5 hover:shadow-xl",
    success: "bg-green-500 text-white hover:bg-green-600 hover:-translate-y-0.5 hover:shadow-xl",
    secondary: "bg-gray-400 text-white hover:bg-gray-500 hover:-translate-y-0.5 hover:shadow-xl",
    outline: "bg-transparent border-2 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white hover:-translate-y-0.5 hover:shadow-xl",
    disabled: "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${disabled ? variants.disabled : variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export default Button;
