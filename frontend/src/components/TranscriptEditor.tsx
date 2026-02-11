/**
 * Main transcript editor component
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranscription } from '../hooks/useTranscription';
import { TranscriptSegment } from './TranscriptSegment';
import { LoadingSpinner } from './LoadingSpinner';
import { exportTranscript, downloadExport } from '../services/api';
import './TranscriptEditor.css';

interface TranscriptEditorProps {
    transcriptId: string;
    onBack: () => void;
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

    const renameInputRef = useRef<HTMLInputElement>(null);
    const exportDropdownRef = useRef<HTMLDivElement>(null);

    // Load transcript on mount
    useEffect(() => {
        loadTranscript(transcriptId);
    }, [transcriptId, loadTranscript]);

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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
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
                            {saveStatus === 'saving' && '⏳ Saving...'}
                            {saveStatus === 'saved' && '✓ Saved'}
                            {saveStatus === 'error' && '✗ Error saving'}
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
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                <path d="M3 7v6h6" />
                                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                            </svg>
                        </button>
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={redo}
                            disabled={!canRedo}
                            title="Redo (Ctrl+Shift+Z)"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                <path d="M21 7v6h-6" />
                                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
                            </svg>
                        </button>
                    </div>

                    {/* Export */}
                    <div className="editor__export-dropdown" ref={exportDropdownRef}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Export
                        </button>
                        {exportDropdownOpen && (
                            <div className="editor__export-menu">
                                <button onClick={() => handleExport('txt')}>
                                    📄 Text (.txt)
                                </button>
                                <button onClick={() => handleExport('srt')}>
                                    🎬 Subtitles (.srt)
                                </button>
                                <button onClick={() => handleExport('json')}>
                                    📊 JSON (.json)
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

            {/* Segments */}
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
                            speakerId={segment.speaker_id}
                            speakerName={getSpeakerName(segment.speaker_id)}
                            speakerColor={getSpeakerColor(segment.speaker_id)}
                            words={segment.words}
                            isEdited={segment.is_edited}
                            showFillerWords={showFillerWords}
                            onTextChange={(text) => handleSegmentTextChange(segment.id, text)}
                            onSpeakerClick={() => label && handleSpeakerClick(label.id, getSpeakerName(segment.speaker_id))}
                        />
                    );
                })}
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
