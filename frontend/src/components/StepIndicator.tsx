import React from 'react';

interface StepIndicatorProps {
  steps: string[];
  current: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, current }) => {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((_, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            <div className={`
              w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
              transition-all duration-300
              ${i < current  ? 'bg-blue-600 text-white'       : ''}
              ${i === current ? 'bg-blue-600 text-white ring-4 ring-blue-200 scale-110' : ''}
              ${i > current  ? 'bg-blue-100 text-blue-400'    : ''}
            `}>
              {i < current ? '✓' : i + 1}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 max-w-8 h-0.5 transition-all duration-500
              ${i < current ? 'bg-blue-600' : 'bg-blue-100'}`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default StepIndicator;
