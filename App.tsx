
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ImageCard from './components/ImageCard';
import ProgressBar from './components/ProgressBar';
import SelectionToolbar from './components/SelectionToolbar';
import { analyzePinterestBoard } from './services/geminiService';
import { BoardAnalysis, AppStatus, PinImage, DownloadState } from './types';

const App: React.FC = () => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [analysis, setAnalysis] = useState<BoardAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [downloadState, setDownloadState] = useState<DownloadState>({
    selectedImages: [],
    isDownloading: false,
    progress: 0,
    totalImages: 0
  });
  const [scrapingProgress, setScrapingProgress] = useState<number>(0);

  // Update download state when analysis changes
  useEffect(() => {
    if (analysis) {
      setDownloadState(prev => ({
        ...prev,
        totalImages: analysis.images.length
      }));
    }
  }, [analysis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

    setStatus(AppStatus.SCRAPING);
    setError(null);
    setAnalysis(null);
    setSelectedImages(new Set());
    setScrapingProgress(0);

    try {
      const result = await analyzePinterestBoard(targetUrl);
      if (!result.images || result.images.length === 0) {
        throw new Error("Nenhuma imagem pública foi encontrada. Verifique se a pasta não é privada.");
      }
      
      // Add selection property to images
      const imagesWithSelection = result.images.map(img => ({
        ...img,
        isSelected: false,
        downloadProgress: 0
      }));
      
      setAnalysis({
        ...result,
        images: imagesWithSelection
      });
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao processar o link. Tente outro proxy ou aguarde.');
      setStatus(AppStatus.ERROR);
    }
  };

  const handleImageSelect = (imageId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedImages);
    
    if (isSelected) {
      newSelected.add(imageId);
    } else {
      newSelected.delete(imageId);
    }
    
    setSelectedImages(newSelected);
    
    // Update image selection in analysis
    if (analysis) {
      const updatedImages = analysis.images.map(img => 
        img.id === imageId ? { ...img, isSelected } : img
      );
      
      setAnalysis({
        ...analysis,
        images: updatedImages
      });
    }
  };

  const handleSelectAll = () => {
    if (!analysis) return;
    
    const allImageIds = analysis.images.map(img => img.id);
    setSelectedImages(new Set(allImageIds));
    
    const updatedImages = analysis.images.map(img => ({
      ...img,
      isSelected: true
    }));
    
    setAnalysis({
      ...analysis,
      images: updatedImages
    });
  };

  const handleClearSelection = () => {
    setSelectedImages(new Set());
    
    if (analysis) {
      const updatedImages = analysis.images.map(img => ({
        ...img,
        isSelected: false
      }));
      
      setAnalysis({
        ...analysis,
        images: updatedImages
      });
    }
  };

  const handleDownloadSelected = async () => {
    if (!analysis || selectedImages.size === 0) return;
    
    setDownloadState(prev => ({
      ...prev,
      isDownloading: true,
      selectedImages: Array.from(selectedImages)
    }));
    
    try {
      // Simulate download progress
      for (let i = 0; i <= 100; i += 10) {
        setDownloadState(prev => ({
          ...prev,
          progress: i
        }));
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Open selected images for download
      const selectedImageObjects = analysis.images.filter(img => selectedImages.has(img.id));
      selectedImageObjects.forEach((img, index) => {
        setTimeout(() => {
          window.open(img.url, '_blank');
        }, index * 300);
      });
      
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setDownloadState(prev => ({
        ...prev,
        isDownloading: false,
        progress: 0
      }));
    }
  };

  const handleDownloadAll = () => {
    if (!analysis) return;
    
    const confirmDownload = window.confirm(`Atenção: O navegador vai tentar abrir ${analysis.images.length} imagens. Você precisará permitir popups no seu navegador!`);
    
    if (confirmDownload) {
      analysis.images.forEach((img, index) => {
        setTimeout(() => {
          window.open(img.url, '_blank');
        }, index * 400);
      });
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case AppStatus.SCRAPING:
        return 'Coletando imagens do Pinterest...';
      case AppStatus.LOADING:
        return 'Processando solicitação...';
      case AppStatus.DOWNLOADING:
        return 'Preparando download...';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-grow">
        <section className="bg-white border-b border-slate-100 pt-12 pb-16 px-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-pink-500 to-red-600"></div>
          
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight">
              PinCollect <span className="text-red-600">Pro</span>
            </h1>
            <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto">
              Baixe coleções completas do Pinterest em alta resolução usando inteligência artificial.
            </p>

            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
              <div className="flex flex-col md:flex-row gap-2 p-2 bg-white rounded-3xl shadow-2xl border border-gray-100 focus-within:ring-2 focus-within:ring-red-100 transition-all">
                <input
                  type="text"
                  placeholder="Cole o link da pasta aqui..."
                  className="flex-grow px-6 py-4 rounded-2xl text-lg outline-none text-gray-700 bg-transparent"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={status === AppStatus.LOADING}
                />
                <button
                  type="submit"
                  disabled={status === AppStatus.SCRAPING}
                  className="bg-red-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {status === AppStatus.SCRAPING ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Coletando...
                    </>
                  ) : (
                    'Coletar Imagens'
                  )}
                </button>
              </div>
              <p className="mt-4 text-xs text-slate-400 font-medium">
                * Se o site estiver instável, a IA usará Google Search para encontrar os links.
              </p>
            </form>

            {getStatusMessage() && (
              <div className="mt-6 max-w-lg mx-auto">
                <ProgressBar 
                  progress={scrapingProgress}
                  message={getStatusMessage()}
                />
              </div>
            )}

            {error && (
              <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 max-w-lg mx-auto flex items-center gap-3 animate-pulse">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-semibold">{error}</span>
              </div>
            )}
          </div>
        </section>

        {analysis && (
          <section className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex gap-4 items-center">
                <div className="bg-red-50 p-3 rounded-2xl">
                  <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.42 7.63 11.17-.1-.95-.19-2.4.04-3.43.21-.92 1.34-5.69 1.34-5.69s-.34-.68-.34-1.69c0-1.58.92-2.76 2.06-2.76.97 0 1.44.73 1.44 1.6 0 .97-.62 2.43-.94 3.78-.27 1.13.56 2.05 1.67 2.05 2 0 3.54-2.11 3.54-5.16 0-2.7-1.94-4.59-4.71-4.59-3.21 0-5.1 2.41-5.1 4.9 0 .97.37 2.01.84 2.58.09.11.11.21.08.33l-.31 1.27c-.05.2-.16.24-.37.14-1.39-.65-2.26-2.68-2.26-4.3 0-3.5 2.54-6.72 7.34-6.72 3.85 0 6.85 2.75 6.85 6.42 0 3.83-2.41 6.94-5.76 6.94-1.12 0-2.18-.58-2.54-1.27l-.69 2.63c-.25.96-.92 2.16-1.37 2.9 1.12.33 2.3.51 3.53.51 6.63 0 12-5.37 12-12S18.63 0 12 0z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 leading-tight">{analysis.boardName}</h2>
                  <p className="text-slate-400 font-medium text-sm">{analysis.images.length} imagens preparadas</p>
                </div>
              </div>
            </div>

            {/* Selection Toolbar */}
            <SelectionToolbar
              selectedCount={selectedImages.size}
              totalCount={analysis.images.length}
              onDownloadSelected={handleDownloadSelected}
              onDownloadAll={handleDownloadAll}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              className="mb-8"
            />

            {/* Progress Bar for Downloads */}
            {downloadState.isDownloading && (
              <div className="mb-8">
                <ProgressBar 
                  progress={downloadState.progress}
                  message="Preparando download das imagens selecionadas..."
                />
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {analysis.images.map((image, idx) => (
                <ImageCard 
                  key={image.id || idx} 
                  image={image as PinImage} 
                  onSelect={handleImageSelect}
                  isSelected={image.isSelected}
                  downloadProgress={image.downloadProgress || 0}
                />
              ))}
            </div>
          </section>
        )}

        {status === AppStatus.IDLE && (
          <div className="max-w-xl mx-auto mt-16 text-center">
             <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-slate-900 font-bold mb-4">Como funciona?</h3>
                <ol className="text-left text-sm text-slate-500 space-y-3">
                  <li className="flex gap-3"><span className="bg-red-100 text-red-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</span> Cole o link de uma pasta pública do Pinterest.</li>
                  <li className="flex gap-3"><span className="bg-red-100 text-red-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</span> Nossa IA tenta ler o site original usando proxies.</li>
                  <li className="flex gap-3"><span className="bg-red-100 text-red-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</span> Caso o acesso seja bloqueado, usamos Google Search Grounding para achar os pins.</li>
                  <li className="flex gap-3"><span className="bg-red-100 text-red-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">4</span> Você baixa tudo em alta resolução!</li>
                </ol>
             </div>
          </div>
        )}
      </main>

      <footer className="py-12 text-center border-t border-slate-100 mt-20">
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
          PinCollect Pro — Inteligência Artificial & Automação
        </p>
      </footer>
    </div>
  );
};

export default App;
