"use client";

import React, { useState } from "react";

export interface AppInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  placeholder,
  icon,
  ...rest
}) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLInputElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div className="w-full min-w-[200px] relative">
      {label && (
        <label className="block mb-1.5 text-xs font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="relative w-full">
        <input
          className="peer relative z-10 h-10 w-full rounded-md border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 outline-none shadow-sm transition-all duration-200 ease-in-out placeholder:font-medium focus:border-[#4059ad] focus:ring-2 focus:ring-[#4059ad]/25"
          placeholder={placeholder}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          {...rest}
        />
        {isHovering && (
          <>
            <div
              className="absolute pointer-events-none top-0 left-0 right-0 h-[2px] z-20 rounded-t-md overflow-hidden"
              style={{
                background: `radial-gradient(30px circle at ${mousePosition.x}px 0px, rgba(64,89,173,0.9) 0%, transparent 70%)`,
              }}
            />
            <div
              className="absolute pointer-events-none bottom-0 left-0 right-0 h-[2px] z-20 rounded-b-md overflow-hidden"
              style={{
                background: `radial-gradient(30px circle at ${mousePosition.x}px 2px, rgba(64,89,173,0.9) 0%, transparent 70%)`,
              }}
            />
          </>
        )}
        {icon && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 z-20 text-slate-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppInput;

