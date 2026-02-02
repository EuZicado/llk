
import React, { useState } from 'react';
import { PinImage } from '../types';

interface ImageCardProps {
  image: PinImage;
  onSelect?: (id: string, selected: boolean) => void;
  isSelected?: boolean;
  downloadProgress?: number;
}

const ImageCard: React.FC<ImageCardProps> = ({ 
  image, 
  onSelect, 
  isSelected = false,
  downloadProgress = 0 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      // Try direct download first
      const link = document.createElement('a');
      link.href = image.url;
      link.download = `${image.title || 'pinterest-image'}.jpg`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      // Fallback to opening in new tab
      window.open(image.url, '_blank');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(image.id, e.target.checked);
  };

  return (
    <div className={`group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${isSelected ? 'ring-2 ring-red-500' : ''}`}>
      {/* Selection Checkbox */}
      <div className="absolute top-2 left-2 z-10">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleSelect}
            className="w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500 focus:ring-2"
          />
        </label>
      </div>

      {/* Download Progress Bar */}
      {downloadProgress > 0 && downloadProgress < 100 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
          <div 
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${downloadProgress}%` }}
          />
        </div>
      )}

      {/* Image Container */}
      <div 
        className="aspect-[3/4] bg-gray-100 flex items-center justify-center relative overflow-hidden cursor-pointer"
        onClick={handleDownload}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img 
          src={image.thumbnail || image.url} 
          alt={image.title} 
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Overlay with Actions */}
        <div className={`absolute inset-0 bg-black/40 opacity-0 transition-opacity flex flex-col items-center justify-center gap-3 p-4 ${isHovered || isLoading ? 'opacity-100' : ''}`}>
          {isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-white text-sm font-medium">Downloading...</span>
            </div>
          ) : (
            <>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className="bg-red-600 text-white w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 active:scale-95 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
              <span className="text-white text-[10px] uppercase font-bold tracking-widest bg-black/50 px-2 py-1 rounded">HD Quality</span>
            </>
          )}
        </div>

        {/* Download Progress Indicator */}
        {downloadProgress > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-lg">
            {Math.round(downloadProgress)}%
          </div>
        )}
      </div>

      {/* Image Info */}
      <div className="p-3">
        <h3 className="text-xs font-semibold text-gray-800 line-clamp-1 mb-1" title={image.title}>
          {image.title || 'Pinterest Image'}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400 font-medium">#{image.id.substring(0,6)}</span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            <span className="text-[8px] text-gray-500 uppercase font-bold">HD</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCard;
