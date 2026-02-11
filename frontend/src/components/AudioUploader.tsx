/**
 * Audio file uploader component with drag-and-drop
 */

import { useCallback, useState, useRef } from 'react';
import { useAudioUpload } from '../hooks/useAudioUpload';
import { LoadingSpinner } from './LoadingSpinner';
import './AudioUploader.css';

interface AudioUploaderProps {
    onTranscriptionComplete: (transcriptId: string) => void;
}

// Format file size
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AudioUploader({ onTranscriptionComplete }: AudioUploaderProps) {
    const {
        state,
        progress,
        transcriptId,
        error,
        file,
        uploadFile,
        transcribe,
        reset,
    } = useAudioUpload();

    const [isDragging, setIsDragging] = useState(false);
    const [wordBoost, setWordBoost] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle file selection
    const handleFileSelect = useCallback((selectedFile: File) => {
        // Validate file type
        const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/flac', 'audio/ogg', 'audio/webm'];
        const ext = selectedFile.name.split('.').pop()?.toLowerCase();
        const validExts = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'webm', 'mp4'];

        if (!validTypes.includes(selectedFile.type) && ext && !validExts.includes(ext)) {
            alert('Please select a valid audio file (mp3, wav, m4a, flac, ogg, webm)');
            return;
        }

        uploadFile(selectedFile);
    }, [uploadFile]);

    // Handle drag events
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    }, [handleFileSelect]);

    // Handle file input change
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFileSelect(files[0]);
        }
    }, [handleFileSelect]);

    // Handle transcription start
    const handleTranscribe = useCallback(() => {
        const boost = wordBoost.split(',').map(w => w.trim()).filter(Boolean);
        transcribe(boost.length > 0 ? boost : undefined);
    }, [transcribe, wordBoost]);

    // Watch for transcription completion
    if (state === 'completed' && transcriptId) {
        onTranscriptionComplete(transcriptId);
    }

    // Render based on state
    if (state === 'idle') {
        return (
            <div
                className={`uploader ${isDragging ? 'uploader--dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleInputChange}
                    style={{ display: 'none' }}
                />
                <div className="uploader__content">
                    <div className="uploader__icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                    </div>
                    <h3 className="uploader__title">Drop your audio file here</h3>
                    <p className="uploader__subtitle">or click to browse</p>
                    <p className="uploader__formats">MP3, WAV, M4A, FLAC, OGG, WebM (max 100MB)</p>
                </div>
            </div>
        );
    }

    if (state === 'uploading') {
        return (
            <div className="uploader uploader--uploading">
                <LoadingSpinner size="large" message="Uploading file..." />
                <div className="uploader__progress">
                    <div className="uploader__progress-bar" style={{ width: `${progress}%` }} />
                </div>
            </div>
        );
    }

    if (state === 'uploaded') {
        return (
            <div className="uploader uploader--uploaded glass-card">
                <div className="uploader__file-info">
                    <div className="uploader__file-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                        </svg>
                    </div>
                    <div className="uploader__file-details">
                        <h4>{file?.name}</h4>
                        <p>{file && formatFileSize(file.size)}</p>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={reset} title="Remove file">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="uploader__word-boost">
                    <label htmlFor="wordBoost">
                        Word Boost (optional)
                        <span className="tooltip" data-tooltip="Improve recognition of technical terms">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </span>
                    </label>
                    <input
                        id="wordBoost"
                        type="text"
                        className="input"
                        placeholder="Supabase, FastAPI, AssemblyAI..."
                        value={wordBoost}
                        onChange={(e) => setWordBoost(e.target.value)}
                    />
                </div>

                <button className="btn btn-primary uploader__transcribe-btn" onClick={handleTranscribe}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                        <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Transcribe Audio
                </button>
            </div>
        );
    }

    if (state === 'transcribing') {
        return (
            <div className="uploader uploader--transcribing glass-card">
                <LoadingSpinner size="large" />
                <h3>Transcribing audio...</h3>
                <p className="text-secondary">This may take a few minutes for longer files</p>
                <div className="uploader__progress">
                    <div className="uploader__progress-bar uploader__progress-bar--animated" style={{ width: `${progress || 30}%` }} />
                </div>
                <p className="uploader__progress-text">{progress || '...'}% complete</p>
            </div>
        );
    }

    if (state === 'error') {
        return (
            <div className="uploader uploader--error glass-card">
                <div className="uploader__error-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                </div>
                <h3>Something went wrong</h3>
                <p className="text-error">{error}</p>
                <button className="btn btn-secondary" onClick={reset}>
                    Try Again
                </button>
            </div>
        );
    }

    return null;
}
