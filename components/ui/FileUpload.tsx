import React, { useRef, useState, useEffect } from 'react';
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // Thêm state lưu URL ảnh
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tạo URL xem trước khi có file mới
  const handleFile = (file: File) => {
    setSelectedFile(file);
    onFileSelect(file);

    // Nếu là file ảnh thì tạo preview
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // Dọn dẹp bộ nhớ (Revoke URL) để tránh rò rỉ bộ nhớ
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
          relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 cursor-pointer
          flex flex-col items-center justify-center text-center gap-3 min-h-[200px]
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
          <div className="flex flex-col items-center w-full">
            {/* PHẦN HIỂN THỊ ẢNH XEM TRƯỚC */}
            <div className="relative w-32 h-32 mb-3 group">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover rounded-lg border border-slate-700 shadow-md"
                />
              ) : (
                <div className="w-full h-full bg-indigo-500/20 rounded-lg flex items-center justify-center">
                  <FileIcon className="text-indigo-400 w-10 h-10" />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <p className="font-medium text-white text-sm" title={selectedFile.name}>
                {formatFileName(selectedFile.name)}
              </p>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            <button
              onClick={clearFile}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-700 hover:bg-red-500 text-white transition-all shadow-lg"
              title="Remove file"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 bg-slate-700/50 rounded-full flex items-center justify-center border border-slate-600">
              <UploadCloud className="text-slate-300 w-7 h-7" />
            </div>
            <div>
              <p className="font-bold text-white tracking-tight">{label}</p>
              <p className="text-xs text-slate-500 mt-1">PNG, JPG or WebP (Max 10MB)</p>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Helper cho Drag and Drop
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }
};