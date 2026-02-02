import React from 'react';

interface ProgressBarProps {
  progress: number;
  message?: string;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  message, 
  className = '' 
}) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  
  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          {message || 'Processing...'}
        </span>
        <span className="text-sm font-bold text-red-600">
          {Math.round(clampedProgress)}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className="bg-gradient-to-r from-red-500 to-pink-500 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {clampedProgress === 100 && (
        <div className="flex items-center justify-center mt-2 text-green-600">
          <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">Complete!</span>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;