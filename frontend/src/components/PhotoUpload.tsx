import { useState, useRef, useCallback } from 'react';
import { X, Camera, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';

interface Photo {
  id?: string;
  image_url: string;
  thumbnail_url?: string;
  issue_type?: string;
  notes?: string;
  created_at?: string;
}

interface PhotoUploadProps {
  apiUrl: string;
  existingPhotos?: Photo[];
  onPhotosChange?: (photos: Photo[]) => void;
  uploadEndpoint: string;
  maxPhotos?: number;
  issueType?: string;
  questionId?: string;
  disabled?: boolean;
}

export default function PhotoUpload({
  apiUrl,
  existingPhotos = [],
  onPhotosChange,
  uploadEndpoint,
  maxPhotos = 5,
  issueType,
  questionId,
  disabled = false
}: PhotoUploadProps) {
  const [photos, setPhotos] = useState<Photo[]>(existingPhotos);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem('token');

  const updatePhotos = useCallback((newPhotos: Photo[]) => {
    setPhotos(newPhotos);
    onPhotosChange?.(newPhotos);
  }, [onPhotosChange]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, source: 'file' | 'camera') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check max photos limit
    if (photos.length + files.length > maxPhotos) {
      alert(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    setUploading(true);
    const uploadedPhotos: Photo[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert(`Skipping ${file.name}: Not an image file`);
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert(`Skipping ${file.name}: File too large (max 10MB)`);
          continue;
        }

        const formData = new FormData();
        formData.append('photo', file);
        if (issueType) formData.append('issueType', issueType);
        if (questionId) formData.append('questionId', questionId);
        formData.append('source', source);

        const response = await fetch(`${apiUrl}${uploadEndpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        const result = await response.json();
        uploadedPhotos.push({
          id: result.id,
          image_url: result.imageUrl,
          thumbnail_url: result.thumbnailUrl,
          issue_type: issueType,
          created_at: new Date().toISOString()
        });
      }

      const newPhotos = [...photos, ...uploadedPhotos];
      updatePhotos(newPhotos);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      // Reset file inputs
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleDelete = async (photoId: string, index: number) => {
    if (!confirm('Delete this photo?')) return;

    try {
      // Determine delete endpoint based on photo type
      const isInspection = uploadEndpoint.includes('inspection');
      const deleteEndpoint = isInspection 
        ? `/photos/inspection/${photoId}`
        : `/photos/audit/${photoId}`;

      const response = await fetch(`${apiUrl}${deleteEndpoint}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }

      const newPhotos = photos.filter((_, i) => i !== index);
      updatePhotos(newPhotos);
    } catch (error: any) {
      alert(`Delete failed: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {photos.map((photo, index) => (
            <div key={photo.id || index} className="relative group">
              <img
                src={photo.thumbnail_url || photo.image_url}
                alt={`Photo ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setPreviewImage(photo.image_url)}
              />
              {!disabled && (
                <button
                  onClick={() => handleDelete(photo.id!, index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  title="Delete photo"
                >
                  <X size={14} />
                </button>
              )}
              {photo.issue_type && (
                <span className="absolute bottom-1 left-1 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded">
                  {photo.issue_type}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Controls */}
      {!disabled && photos.length < maxPhotos && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {uploading ? (<Loader2 size={16} className="animate-spin" />) : (<Upload size={16} />)}
            Upload Photo
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {uploading ? (<Loader2 size={16} className="animate-spin" />) : (<Camera size={16} />)}
            Take Photo
          </button>

          <span className="text-sm text-gray-500 self-center">
            {photos.length}/{maxPhotos} photos
          </span>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFileSelect(e, 'file')}
        className="hidden"
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileSelect(e, 'camera')}
        className="hidden"
      />

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X size={24} />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
