import { OpenFileDialog } from '../../wailsjs/go/main/App';

interface FileDropZoneProps {
  onFileLoad: (path: string) => void;
  isLoading: boolean;
  errorMessage?: string;
  onOpenFileDialog: () => void;
}

export default function FileDropZone({ onFileLoad, isLoading, errorMessage, onOpenFileDialog }: FileDropZoneProps) {
  const handleOpenFileDialog = async () => {
    try {
      const path = await OpenFileDialog();
      if (path) {
        onFileLoad(path);
      }
    } catch (error) {
      console.error('[FileDropZone] Error opening file dialog:', error);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center m-8 rounded-lg">
        {isLoading ? (
          <div className="text-2xl text-primary">Loading...</div>
        ) : (
          <>
            <div className="text-6xl mb-4">📄</div>
            <p className="text-xl my-2">Select a log file to analyze</p>
            <button
              className="mt-4 px-8 py-3 bg-primary text-white rounded cursor-pointer transition-colors duration-300 text-base hover:bg-primary-hover"
              onClick={onOpenFileDialog}
            >
              Browse Files
            </button>
            <p className="text-sm text-gray-500 mt-4">
              Press <kbd className="px-2 py-1 bg-border rounded text-gray-400">Ctrl+O</kbd> to open file
            </p>
          </>
        )}
      </div>

      {errorMessage && !isLoading && (
        <div className="mx-8 mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200">
          <p className="font-semibold mb-1">⚠️ Error</p>
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
