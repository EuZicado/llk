import React from 'react';

interface SelectionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onDownloadSelected: () => void;
  onDownloadAll: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  className?: string;
}

const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  selectedCount,
  totalCount,
  onDownloadSelected,
  onDownloadAll,
  onSelectAll,
  onClearSelection,
  className = ''
}) => {
  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const hasSelection = selectedCount > 0;

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-4 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              Selected:
            </span>
            <span className="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {selectedCount} of {totalCount}
            </span>
          </div>
          
          {hasSelection && (
            <div className="flex items-center gap-2">
              <button
                onClick={onClearSelection}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
              
              {!isAllSelected && (
                <button
                  onClick={onSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Select All
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {hasSelection && (
            <button
              onClick={onDownloadSelected}
              disabled={!hasSelection}
              className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Selected ({selectedCount})
            </button>
          )}
          
          <button
            onClick={onDownloadAll}
            className="bg-black text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-800 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Download All ({totalCount})
          </button>
        </div>
      </div>
      
      {hasSelection && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Bulk download ready</span>
            <span>ZIP format • High quality images</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectionToolbar;