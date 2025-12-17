import React, { useRef, useState } from 'react';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  label?: string;
  resetTrigger?: any;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = "image/*",
  label = "Upload Image"
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Truncate filename logic
  const formatFileName = (name: string) => {
    if (name.length > 20) {
      return name.substring(0, 20) + '...';
    }
    return name;
  };

  return (
    <div className="w-full">
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer
          flex flex-col items-center justify-center text-center gap-3
          ${isDragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-slate-600 hover:border-indigo-400 hover:bg-slate-800'
          }
          ${selectedFile ? 'bg-slate-800 border-indigo-500/50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-2">
              <FileIcon className="text-indigo-400 w-8 h-8" />
            </div>
            <p className="font-medium text-white" title={selectedFile.name}>
              {formatFileName(selectedFile.name)}
            </p>
            <p className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            <button
              onClick={clearFile}
              className="absolute top-2 right-2 p-1 rounded-full bg-slate-700 hover:bg-red-500/80 text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
              <UploadCloud className="text-slate-300 w-6 h-6" />
            </div>
            <div>
              <p className="font-medium text-white">{label}</p>
              <p className="text-xs text-slate-400 mt-1">Drag & drop or click to browse</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};