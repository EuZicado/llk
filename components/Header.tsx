
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-2 rounded-lg">
               <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.42 7.63 11.17-.1-.95-.19-2.4.04-3.43.21-.92 1.34-5.69 1.34-5.69s-.34-.68-.34-1.69c0-1.58.92-2.76 2.06-2.76.97 0 1.44.73 1.44 1.6 0 .97-.62 2.43-.94 3.78-.27 1.13.56 2.05 1.67 2.05 2 0 3.54-2.11 3.54-5.16 0-2.7-1.94-4.59-4.71-4.59-3.21 0-5.1 2.41-5.1 4.9 0 .97.37 2.01.84 2.58.09.11.11.21.08.33l-.31 1.27c-.05.2-.16.24-.37.14-1.39-.65-2.26-2.68-2.26-4.3 0-3.5 2.54-6.72 7.34-6.72 3.85 0 6.85 2.75 6.85 6.42 0 3.83-2.41 6.94-5.76 6.94-1.12 0-2.18-.58-2.54-1.27l-.69 2.63c-.25.96-.92 2.16-1.37 2.9 1.12.33 2.3.51 3.53.51 6.63 0 12-5.37 12-12S18.63 0 12 0z"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">PinCollect AI</span>
          </div>
          <nav className="hidden md:flex space-x-8">
            <a href="#" className="text-gray-500 hover:text-gray-900 font-medium">Início</a>
            <a href="#" className="text-gray-500 hover:text-gray-900 font-medium">Como funciona</a>
            <a href="#" className="text-gray-500 hover:text-gray-900 font-medium">Dúvidas</a>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
