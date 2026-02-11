/**
 * Main transcript editor component
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { 
    ChevronLeft, 
    Undo2, 
    Redo2, 
    Download, 
    FileText, 
    Film, 
    FileJson,
    Loader2,
    Check,
    X,
    Music
} from 'lucide-react';
import { useTranscription } from '../hooks/useTranscription';
import { TranscriptSegment } from './TranscriptSegment';
import { LoadingSpinner } from './LoadingSpinner';
import { exportTranscript, downloadExport, getAudioUrl } from '../services/api';
import './TranscriptEditor.css';

interface TranscriptEditorProps {
    transcriptId: string;
    onBack: () => void;
}

// Format duration
function formatDuration(seconds: number | null): string {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function TranscriptEditor({ transcriptId, onBack }: TranscriptEditorProps) {
    const {
        transcript,
        loading,
        error,
        canUndo,
        canRedo,
        loadTranscript,
        updateSegmentText,
        renameSpeaker,
        undo,
        redo,
        getSpeakerColor,
        getSpeakerName,
    } = useTranscription();

    const [showFillerWords, setShowFillerWords] = useState(true);
    const [filterSpeaker, setFilterSpeaker] = useState<string | null>(null);
    const [renamingLabel, setRenamingLabel] = useState<string | null>(null);
    const [newSpeakerName, setNewSpeakerName] = useState('');
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
    const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement>(null);

    const renameInputRef = useRef<HTMLInputElement>(null);
    const exportDropdownRef = useRef<HTMLDivElement>(null);

    // Load transcript on mount
    useEffect(() => {
        loadTranscript(transcriptId);
    }, [transcriptId, loadTranscript]);

    // Load audio URL when transcript is loaded
    useEffect(() => {
        if (transcript?.storage_path) {
            const url = getAudioUrl(transcript.storage_path);
            setAudioUrl(url);
        }
    }, [transcript?.storage_path]);

    // Handle seeking to a specific time
    const handleSeek = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            audioRef.current.play();
        }
    }, []);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl/Cmd + Z for undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (canUndo) undo();
            }
            // Ctrl/Cmd + Shift + Z for redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                if (canRedo) redo();
            }
            // Ctrl/Cmd + S for save (visual feedback only, auto-saves)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus(null), 2000);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canUndo, canRedo, undo, redo]);

    // Close export dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
                setExportDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle segment text update
    const handleSegmentTextChange = useCallback((segmentId: string, text: string) => {
        setSaveStatus('saving');
        updateSegmentText(segmentId, text)
            .then(() => {
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus(null), 2000);
            })
            .catch(() => {
                setSaveStatus('error');
            });
    }, [updateSegmentText]);

    // Handle speaker rename
    const handleSpeakerClick = useCallback((labelId: string, currentName: string) => {
        setRenamingLabel(labelId);
        setNewSpeakerName(currentName.startsWith('Speaker ') ? '' : currentName);
        setTimeout(() => renameInputRef.current?.focus(), 0);
    }, []);

    const handleRenameSave = useCallback(() => {
        if (renamingLabel && newSpeakerName.trim()) {
            renameSpeaker(renamingLabel, newSpeakerName.trim());
        }
        setRenamingLabel(null);
        setNewSpeakerName('');
    }, [renamingLabel, newSpeakerName, renameSpeaker]);

    const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRenameSave();
        } else if (e.key === 'Escape') {
            setRenamingLabel(null);
            setNewSpeakerName('');
        }
    }, [handleRenameSave]);

    // Handle export
    const handleExport = useCallback(async (format: 'txt' | 'srt' | 'json') => {
        setExportDropdownOpen(false);
        try {
            const result = await exportTranscript(transcriptId, format);
            downloadExport(result);
        } catch (err) {
            console.error('Export failed:', err);
        }
    }, [transcriptId]);

    // Filter segments by speaker
    const filteredSegments = filterSpeaker
        ? transcript?.segments.filter(s => s.speaker_id === filterSpeaker)
        : transcript?.segments;

    // Loading state
    if (loading) {
        return (
            <div className="editor editor--loading">
                <LoadingSpinner size="large" message="Loading transcript..." />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="editor editor--error">
                <h2>Error loading transcript</h2>
                <p className="text-error">{error}</p>
                <button className="btn btn-secondary" onClick={onBack}>
                    Go Back
                </button>
            </div>
        );
    }

    if (!transcript) {
        return null;
    }

    return (
        <div className="editor">
            {/* Header */}
            <header className="editor__header">
                <div className="editor__header-left">
                    <button className="btn btn-ghost" onClick={onBack}>
                        <ChevronLeft size={20} />
                        Back
                    </button>
                    <div className="editor__title">
                        <h1>{transcript.filename}</h1>
                        <span className="badge badge-completed">
                            {transcript.num_speakers} speaker{transcript.num_speakers !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                <div className="editor__header-right">
                    {/* Save Status */}
                    {saveStatus && (
                        <span className={`editor__save-status editor__save-status--${saveStatus}`}>
                            {saveStatus === 'saving' && <><Loader2 size={14} className="animate-spin" /> Saving...</>}
                            {saveStatus === 'saved' && <><Check size={14} /> Saved</>}
                            {saveStatus === 'error' && <><X size={14} /> Error saving</>}
                        </span>
                    )}

                    {/* Undo/Redo */}
                    <div className="editor__history-buttons">
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={undo}
                            disabled={!canUndo}
                            title="Undo (Ctrl+Z)"
                        >
                            <Undo2 size={20} />
                        </button>
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={redo}
                            disabled={!canRedo}
                            title="Redo (Ctrl+Shift+Z)"
                        >
                            <Redo2 size={20} />
                        </button>
                    </div>

                    {/* Export */}
                    <div className="editor__export-dropdown" ref={exportDropdownRef}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                        >
                            <Download size={18} />
                            Export
                        </button>
                        {exportDropdownOpen && (
                            <div className="editor__export-menu">
                                <button onClick={() => handleExport('txt')}>
                                    <FileText size={16} /> Text (.txt)
                                </button>
                                <button onClick={() => handleExport('srt')}>
                                    <Film size={16} /> Subtitles (.srt)
                                </button>
                                <button onClick={() => handleExport('json')}>
                                    <FileJson size={16} /> JSON (.json)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Toolbar */}
            <div className="editor__toolbar">
                {/* Speaker Filter */}
                <div className="editor__speaker-filters">
                    <span className="editor__toolbar-label">Speakers:</span>
                    <button
                        className={`editor__speaker-chip ${filterSpeaker === null ? 'active' : ''}`}
                        onClick={() => setFilterSpeaker(null)}
                    >
                        All
                    </button>
                    {transcript.speaker_labels.map((label) => (
                        <button
                            key={label.id}
                            className={`editor__speaker-chip ${filterSpeaker === label.speaker_id ? 'active' : ''}`}
                            style={{
                                '--speaker-color': label.color,
                                borderColor: filterSpeaker === label.speaker_id ? label.color : 'transparent',
                            } as React.CSSProperties}
                            onClick={() => setFilterSpeaker(filterSpeaker === label.speaker_id ? null : label.speaker_id)}
                        >
                            {getSpeakerName(label.speaker_id)}
                        </button>
                    ))}
                </div>

                {/* Toggle Filler Words */}
                <label className="editor__toggle">
                    <input
                        type="checkbox"
                        checked={showFillerWords}
                        onChange={(e) => setShowFillerWords(e.target.checked)}
                    />
                    <span className="editor__toggle-label">Highlight filler words</span>
                </label>
            </div>

            {/* Speaker Rename Modal */}
            {renamingLabel && (
                <div className="editor__rename-modal" onClick={() => setRenamingLabel(null)}>
                    <div className="editor__rename-content glass-card" onClick={(e) => e.stopPropagation()}>
                        <h3>Rename Speaker</h3>
                        <input
                            ref={renameInputRef}
                            type="text"
                            className="input"
                            placeholder="Enter speaker name"
                            value={newSpeakerName}
                            onChange={(e) => setNewSpeakerName(e.target.value)}
                            onKeyDown={handleRenameKeyDown}
                        />
                        <div className="editor__rename-actions">
                            <button className="btn btn-ghost" onClick={() => setRenamingLabel(null)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleRenameSave}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Two-Column Layout */}
            <div className="editor__content">
                {/* Left Column - Audio Player */}
                <aside className="editor__audio-panel">
                    <div className="editor__audio-title">
                        <Music size={18} />
                        Audio File
                    </div>
                    
                    {audioUrl ? (
                        <audio
                            ref={audioRef}
                            className="editor__audio-player"
                            src={audioUrl}
                            controls
                        />
                    ) : (
                        <div className="editor__audio-placeholder">
                            Audio not available
                        </div>
                    )}
                    
                    <div className="editor__audio-info">
                        <div className="editor__audio-info-row">
                            <span className="editor__audio-info-label">Duration</span>
                            <span className="editor__audio-info-value">{formatDuration(transcript.duration)}</span>
                        </div>
                        <div className="editor__audio-info-row">
                            <span className="editor__audio-info-label">Speakers</span>
                            <span className="editor__audio-info-value">{transcript.num_speakers}</span>
                        </div>
                        <div className="editor__audio-info-row">
                            <span className="editor__audio-info-label">Segments</span>
                            <span className="editor__audio-info-value">{transcript.segments.length}</span>
                        </div>
                    </div>
                    
                    <p className="editor__audio-hint">
                        Click on any timestamp to seek to that position in the audio.
                    </p>
                </aside>

                {/* Right Column - Transcript Segments */}
                <div className="editor__segments-panel">
                    <div className="editor__segments">
                        {filteredSegments?.map((segment) => {
                            const label = transcript.speaker_labels.find(l => l.speaker_id === segment.speaker_id);

                            return (
                                <TranscriptSegment
                                    key={segment.id}
                                    id={segment.id}
                                    startTime={segment.start_time}
                                    endTime={segment.end_time}
                                    text={segment.text}
                                    originalText={segment.original_text}
                                    speakerId={segment.speaker_id}
                                    speakerName={getSpeakerName(segment.speaker_id)}
                                    speakerColor={getSpeakerColor(segment.speaker_id)}
                                    words={segment.words}
                                    isEdited={segment.is_edited}
                                    showFillerWords={showFillerWords}
                                    onTextChange={(text) => handleSegmentTextChange(segment.id, text)}
                                    onSpeakerClick={() => label && handleSpeakerClick(label.id, getSpeakerName(segment.speaker_id))}
                                    onSeek={handleSeek}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Keyboard Shortcuts Help */}
            <div className="editor__shortcuts">
                <span>⌘/Ctrl + Z: Undo</span>
                <span>⌘/Ctrl + Shift + Z: Redo</span>
                <span>⌘/Ctrl + S: Save</span>
            </div>
        </div>
    );
}
