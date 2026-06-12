import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';
import authService from '../../services/authService';
import { toast } from 'react-hot-toast';
import { ChevronLeft, ChevronRight, X, Image as ImageIcon, Trash2, Maximize2 } from 'lucide-react';
import { resolveImageUrl } from '../../utils/helpers';

const GalleryCarousel = ({ images, token }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const timeoutRef = useRef(null);

    const nextSlide = useCallback(() => {
        setCurrentIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
    }, [images.length]);

    const prevSlide = () => {
        setCurrentIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
    };

    useEffect(() => {
        if (!isPaused && images.length > 1) {
            timeoutRef.current = setTimeout(nextSlide, 3000);
        }
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [currentIndex, isPaused, nextSlide, images.length]);

    if (!images || images.length === 0) return null;

    return (
        <div 
            className="relative w-full aspect-[16/9] md:aspect-[21/9] rounded-[2.5rem] overflow-hidden bg-slate-900 group shadow-2xl shadow-slate-200/50"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Slides */}
            <div className="absolute inset-0 flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                {images.map((img, idx) => (
                    <div key={img.id} className="min-w-full h-full relative">
                        <img
                            src={`${resolveImageUrl(img.image_url)}${token ? `?token=${token}` : ''}`}
                            alt={img.title}
                            className="w-full h-full object-cover"
                        />
                    </div>
                ))}
            </div>

            {/* Navigation Buttons */}
            {images.length > 1 && (
                <>
                    <button 
                        onClick={prevSlide}
                        className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-all border border-white/20"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button 
                        onClick={nextSlide}
                        className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-all border border-white/20"
                    >
                        <ChevronRight size={24} />
                    </button>

                    {/* Indicators */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
                        {images.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const GalleryPage = () => {
    const confirm = useConfirm();
    const { role } = authService.getCurrentUser();
    const isAdmin = role === 'admin';
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [uploadForm, setUploadForm] = useState({ title: '', files: [] });
    const [previews, setPreviews] = useState([]);
    const [fileInputKey, setFileInputKey] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const token = localStorage.getItem('access_token');

    const fetchGallery = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get('gallery/');
            setImages(Array.isArray(res?.data) ? res.data : []);
        } catch (e) {
            setImages([]);
            setError(e?.response?.data?.error || 'Could not load gallery images.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGallery();
    }, []);

    const titleFromFilename = (name) => {
        const fileName = String(name || '').trim();
        if (!fileName) return '';
        const lastDot = fileName.lastIndexOf('.');
        return (lastDot > 0 ? fileName.slice(0, lastDot) : fileName).trim();
    };

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length === 0) return;

        // Update previews
        const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
        setPreviews(prev => {
            // Cleanup old previews if needed, but here we just merge
            return [...prev, ...newPreviews];
        });

        setUploadForm(prev => ({
            ...prev,
            files: [...prev.files, ...selectedFiles]
        }));
    };

    const removeFile = (index) => {
        setUploadForm(prev => {
            const newFiles = [...prev.files];
            newFiles.splice(index, 1);
            return { ...prev, files: newFiles };
        });
        setPreviews(prev => {
            const newPreviews = [...prev];
            URL.revokeObjectURL(newPreviews[index]);
            newPreviews.splice(index, 1);
            return newPreviews;
        });
    };

    const handleUpload = async (e) => {
        if (e) e.preventDefault();
        if (!isAdmin) return;
        if (uploadForm.files.length === 0) {
            toast.error('Please select at least one image.');
            return;
        }

        setUploading(true);
        try {
            const body = new FormData();
            body.append('title', uploadForm.title.trim());
            uploadForm.files.forEach(file => {
                body.append('images', file);
            });

            await api.post('gallery/', body, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success(`Gallery updated with ${uploadForm.files.length} images!`);
            
            // Cleanup previews
            previews.forEach(url => URL.revokeObjectURL(url));
            setPreviews([]);
            setUploadForm({ title: '', files: [] });
            setFileInputKey(v => v + 1);
            await fetchGallery();
        } catch (e) {
            toast.error(e?.response?.data?.error || 'Upload failed.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!isAdmin) return;
        const ok = await confirm('Delete this image?');
        if (!ok) return;
        try {
            await api.delete(`gallery/${id}/`);
            toast.success('Image removed');
            setImages((prev) => prev.filter((img) => img.id !== id));
        } catch (e) {
            toast.error('Delete failed.');
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        const imageFiles = droppedFiles.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
            const newPreviews = imageFiles.map(file => URL.createObjectURL(file));
            setPreviews(prev => [...prev, ...newPreviews]);
            setUploadForm(prev => ({
                ...prev,
                files: [...prev.files, ...imageFiles]
            }));
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                    <h1 className="text-5xl font-black text-school-navy tracking-tight">School Highlights</h1>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">Capturing perfection, one moment at a time.</p>
                </div>
            </div>

            {/* Slider View */}
            {!loading && images.length > 0 && (
                <section className="space-y-6">
                    <GalleryCarousel images={images} token={token} />
                </section>
            )}

            {isAdmin && (
                <section className="bg-white/80 backdrop-blur-xl border border-slate-100 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/40 space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-school-navy uppercase tracking-[0.2em] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-school-blue animate-pulse"></span>
                            Bulk Upload Moments
                        </h3>
                        {uploadForm.files.length > 0 && (
                            <button 
                                onClick={() => {
                                    previews.forEach(p => URL.revokeObjectURL(p));
                                    setPreviews([]);
                                    setUploadForm({ title: '', files: [] });
                                }}
                                className="text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 transition-colors"
                            >
                                Clear Selection
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Drop Zone */}
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={onDrop}
                            className={`relative border-2 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center gap-4 transition-all duration-300 ${isDragging ? 'border-school-blue bg-school-blue/5 scale-[0.99]' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'}`}
                        >
                            <input
                                key={fileInputKey}
                                type="file"
                                multiple
                                accept=".jpg,.jpeg,.png,.webp,.gif"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center text-slate-400 group-hover:text-school-navy transition-colors">
                                <ImageIcon size={32} />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-black text-school-navy">Drop photos here or click to browse</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select multiple images at once</p>
                            </div>
                        </div>

                        {/* Form Details */}
                        <div className="space-y-6 flex flex-col justify-center">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Batch Caption</label>
                                <input
                                    type="text"
                                    placeholder="Enter a title for these images (optional)"
                                    value={uploadForm.title}
                                    onChange={(e) => setUploadForm((prev) => ({ ...prev, title: e.target.value }))}
                                    className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold text-school-navy outline-none focus:border-school-navy/20 focus:bg-white transition-all shadow-sm"
                                />
                                <p className="text-[9px] font-bold text-slate-300 italic ml-1">* If left empty, filenames will be used as titles.</p>
                            </div>

                            <button
                                onClick={handleUpload}
                                disabled={uploading || uploadForm.files.length === 0}
                                className="w-full h-16 bg-school-navy text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-school-navy/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {uploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        <span>Uploading {uploadForm.files.length} Files...</span>
                                    </>
                                ) : (
                                    <span>Upload {uploadForm.files.length || '0'} Images</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Previews */}
                    {previews.length > 0 && (
                        <div className="pt-8 border-t border-slate-50">
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                {previews.map((url, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden group border border-slate-100 shadow-sm animate-in zoom-in duration-300">
                                        <img src={url} alt="Preview" className="w-full h-full object-cover" />
                                        <button 
                                            onClick={() => removeFile(idx)}
                                            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 opacity-30">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-school-navy rounded-full animate-spin"></div>
                </div>
            ) : images.length === 0 ? (
                <div className="py-32 text-center bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/20">
                    <div className="text-7xl mb-6 grayscale opacity-20 transform hover:scale-110 transition-transform">🖼️</div>
                    <h3 className="text-2xl font-black text-school-navy">The gallery is currently empty</h3>
                    <p className="text-slate-400 font-bold max-w-sm mx-auto mt-2 leading-relaxed uppercase text-[10px] tracking-widest">
                        Experience will populate soon once the administration completes synchronizing artifacts.
                    </p>
                </div>
            ) : isAdmin && (
                <section className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-slate-100"></div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Manage Artifacts</h3>
                        <div className="h-px flex-1 bg-slate-100"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {images.map((img) => (
                            <div key={img.id} className="group bg-white rounded-[2rem] border border-slate-100 p-3 shadow-xl shadow-slate-200/40 hover:shadow-2xl transition-all duration-500">
                                <div className="aspect-square rounded-2xl overflow-hidden relative mb-4">
                                    <img
                                        src={`${resolveImageUrl(img.image_url)}${token ? `?token=${token}` : ''}`}
                                        alt={img.title}
                                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                        <button 
                                            onClick={() => handleDelete(img.id)}
                                            className="w-12 h-12 rounded-2xl bg-white text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90"
                                            title="Permanently Remove"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                                <div className="px-2">
                                    <p className="text-xs font-black text-school-navy truncate">{img.title}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Uploaded {new Date(img.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default GalleryPage;
