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
    Play,
    Pause,
    Clock,
    Users,
    Hash,
    Sparkles,
    Keyboard
} from 'lucide-react';
import { useTranscription } from '../hooks/useTranscription';
import { TranscriptSegment } from './TranscriptSegment';
import { LoadingSpinner } from './LoadingSpinner';
import { exportTranscript, downloadExport, getAudioUrl, regenerateSegmentAudio } from '../services/api';
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
        localRegeneratedUrl,
        setLocalRegeneratedUrl,
    } = useTranscription();

    const [showFillerWords, setShowFillerWords] = useState(true);
    const [filterSpeaker, setFilterSpeaker] = useState<string | null>(null);
    const [renamingLabel, setRenamingLabel] = useState<string | null>(null);
    const [newSpeakerName, setNewSpeakerName] = useState('');
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
    const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [useRegenerated, setUseRegenerated] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);

    const audioRef = useRef<HTMLAudioElement>(null);
    const overrideAudioRef = useRef<HTMLAudioElement>(null);
    const playingOverrideRef = useRef(false);
    const overrideSegmentRef = useRef<{ id: string; start_time: number; end_time: number } | null>(null);
    const segmentRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

    const renameInputRef = useRef<HTMLInputElement>(null);
    const exportDropdownRef = useRef<HTMLDivElement>(null);
    const seekBarRef = useRef<HTMLDivElement>(null);
    const seekDraggingRef = useRef(false);

    // Load transcript on mount
    useEffect(() => {
        loadTranscript(transcriptId);
    }, [transcriptId, loadTranscript]);

    // Load audio URL when transcript is loaded
    useEffect(() => {
        if (transcript?.storage_path) {
            getAudioUrl(transcript.storage_path)
                .then(url => setAudioUrl(url))
                .catch(err => {
                    console.error('Failed to load audio URL:', err);
                    setAudioUrl(null);
                });
        }
    }, [transcript?.storage_path]);

    // Sync currentTime from main audio or override; switch to regenerated clip when in segment with override
    useEffect(() => {
        const main = audioRef.current;
        const override = overrideAudioRef.current;
        if (!main || !transcript?.segments) return;

        const onMainTimeUpdate = () => {
            if (playingOverrideRef.current) return;
            const t = main.currentTime;
            if (!useRegenerated) {
                setCurrentTime(t);
                return;
            }
            const segment = transcript.segments.find((s) => s.start_time <= t && t < s.end_time);
            const url = segment ? localRegeneratedUrl(segment.id) : undefined;
            if (segment && url) {
                main.pause();
                playingOverrideRef.current = true;
                overrideSegmentRef.current = {
                    id: segment.id,
                    start_time: segment.start_time,
                    end_time: segment.end_time,
                };
                if (override) {
                    override.src = url;
                    override.currentTime = 0;
                    override.play().catch(() => {
                        playingOverrideRef.current = false;
                        overrideSegmentRef.current = null;
                        main.play();
                    });
                } else {
                    playingOverrideRef.current = false;
                    overrideSegmentRef.current = null;
                    main.play();
                }
            } else {
                setCurrentTime(t);
            }
        };

        const onOverrideTimeUpdate = () => {
            const seg = overrideSegmentRef.current;
            if (seg && override) setCurrentTime(seg.start_time + override.currentTime);
        };

        const onOverrideEnded = () => {
            const seg = overrideSegmentRef.current;
            playingOverrideRef.current = false;
            overrideSegmentRef.current = null;
            if (seg && main) {
                main.currentTime = seg.end_time;
                setCurrentTime(seg.end_time);
                main.play();
            }
        };

        const onMainLoadedMetadata = () => setCurrentTime(main.currentTime);
        main.addEventListener('timeupdate', onMainTimeUpdate);
        main.addEventListener('loadedmetadata', onMainLoadedMetadata);
        if (override) {
            override.addEventListener('timeupdate', onOverrideTimeUpdate);
            override.addEventListener('ended', onOverrideEnded);
        }
        return () => {
            main.removeEventListener('timeupdate', onMainTimeUpdate);
            main.removeEventListener('loadedmetadata', onMainLoadedMetadata);
            if (override) {
                override.removeEventListener('timeupdate', onOverrideTimeUpdate);
                override.removeEventListener('ended', onOverrideEnded);
            }
        };
    }, [audioUrl, useRegenerated, transcript?.segments, localRegeneratedUrl]);

    // Sync isPlaying from main audio
    useEffect(() => {
        const main = audioRef.current;
        if (!main) return;
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        main.addEventListener('play', onPlay);
        main.addEventListener('pause', onPause);
        return () => {
            main.removeEventListener('play', onPlay);
            main.removeEventListener('pause', onPause);
        };
    }, []);

    // When turning off "use regenerated", stop override and resume main from current position
    useEffect(() => {
        if (useRegenerated) return;
        if (!playingOverrideRef.current || !overrideAudioRef.current || !audioRef.current) return;
        const seg = overrideSegmentRef.current;
        const override = overrideAudioRef.current;
        const main = audioRef.current;
        const pos = override.currentTime;
        override.pause();
        override.currentTime = 0;
        playingOverrideRef.current = false;
        if (seg) {
            main.currentTime = seg.start_time + pos;
            setCurrentTime(main.currentTime);
        }
        overrideSegmentRef.current = null;
        main.play();
    }, [useRegenerated]);

    // Which segment contains current playback time (for highlighting; no auto-scroll)
    const activeSegmentId =
        transcript?.segments.find(
            (s) => s.start_time <= currentTime && currentTime < s.end_time
        )?.id ?? null;

    const togglePlayPause = useCallback(() => {
        const main = audioRef.current;
        if (!main) return;
        if (main.paused) main.play().catch(() => {});
        else main.pause();
    }, []);

    // Handle seeking to a specific time; scroll transcript to that segment
    const handleSeek = useCallback(
        (time: number) => {
            if (overrideAudioRef.current && playingOverrideRef.current) {
                overrideAudioRef.current.pause();
                overrideAudioRef.current.currentTime = 0;
                playingOverrideRef.current = false;
                overrideSegmentRef.current = null;
            }
            if (audioRef.current) {
                audioRef.current.currentTime = time;
                audioRef.current.play();
            }
            const segment = transcript?.segments.find(
                (s) => s.start_time <= time && time < s.end_time
            );
            if (segment) {
                segmentRefsMap.current.get(segment.id)?.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth',
                });
            }
        },
        [transcript?.segments]
    );

    const getTimeFromSeekBarX = useCallback(
        (clientX: number): number => {
            const bar = seekBarRef.current;
            if (!bar || !transcript?.duration) return 0;
            const rect = bar.getBoundingClientRect();
            const x = clientX - rect.left;
            const fraction = Math.max(0, Math.min(1, rect.width > 0 ? x / rect.width : 0));
            return fraction * transcript.duration;
        },
        [transcript?.duration]
    );

    const handleSeekBarPointerDown = useCallback(
        (e: React.PointerEvent) => {
            e.preventDefault();
            seekDraggingRef.current = true;
            handleSeek(getTimeFromSeekBarX(e.clientX));
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        },
        [getTimeFromSeekBarX, handleSeek]
    );

    const handleSeekBarPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!seekDraggingRef.current) return;
            e.preventDefault();
            handleSeek(getTimeFromSeekBarX(e.clientX));
        },
        [getTimeFromSeekBarX, handleSeek]
    );

    const handleSeekBarPointerUp = useCallback((e: React.PointerEvent) => {
        seekDraggingRef.current = false;
        try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); } catch (_) {}
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
                <div className="editor__speaker-filters">
                    <span className="editor__toolbar-label">
                        <Users size={16} />
                        Speakers
                    </span>
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

                <label className="editor__toggle">
                    <input
                        type="checkbox"
                        checked={showFillerWords}
                        onChange={(e) => setShowFillerWords(e.target.checked)}
                    />
                    <span className="editor__toggle-label">Highlight filler words</span>
                </label>
            </div>

            {/* Stats bar with icons */}
            <div className="editor__stats-bar">
                <div className="editor__stats-item">
                    <Clock size={16} className="editor__stats-icon" />
                    <span className="editor__stats-label">Duration</span>
                    <span className="editor__stats-value">{formatDuration(transcript.duration)}</span>
                </div>
                <div className="editor__stats-item">
                    <Hash size={16} className="editor__stats-icon" />
                    <span className="editor__stats-label">Segments</span>
                    <span className="editor__stats-value">{transcript.segments.length}</span>
                </div>
                <div className="editor__stats-item">
                    <Users size={16} className="editor__stats-icon" />
                    <span className="editor__stats-label">Speakers</span>
                    <span className="editor__stats-value">{transcript.num_speakers}</span>
                </div>
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

            {/* Hidden audio elements (controlled by mini player) */}
            {audioUrl && (
                <>
                    <audio ref={audioRef} src={audioUrl} style={{ display: 'none' }} />
                    <audio ref={overrideAudioRef} style={{ display: 'none' }} />
                </>
            )}

            {/* Content: player fixed at top, only transcript scrolls */}
            <div className="editor__content">
                {/* Mini player + seeker - outside scroll container so it never scrolls */}
                <div className="editor__player-strip">
                    {audioUrl ? (
                        <>
                            <div className="editor__mini-player">
                                <button
                                    type="button"
                                    className="editor__play-btn"
                                    onClick={togglePlayPause}
                                    title={isPlaying ? 'Pause' : 'Play'}
                                    aria-label={isPlaying ? 'Pause' : 'Play'}
                                >
                                    {isPlaying ? <Pause size={22} /> : <Play size={22} />}
                                </button>
                                <div className="editor__time-display">
                                    <span className="editor__time-current">{formatDuration(currentTime)}</span>
                                    <span className="editor__time-sep">/</span>
                                    <span className="editor__time-total">{formatDuration(transcript.duration)}</span>
                                </div>
                                <div className="editor__mini-stats">
                                    <span className="editor__mini-stat" title="Duration">
                                        <Clock size={14} />
                                        {formatDuration(transcript.duration)}
                                    </span>
                                    <span className="editor__mini-stat" title="Speakers">
                                        <Users size={14} />
                                        {transcript.num_speakers}
                                    </span>
                                    <span className="editor__mini-stat" title="Segments">
                                        <Hash size={14} />
                                        {transcript.segments.length}
                                    </span>
                                </div>
                                <label className="editor__mini-toggle" title="Use regenerated audio where available">
                                    <input
                                        type="checkbox"
                                        checked={useRegenerated}
                                        onChange={(e) => setUseRegenerated(e.target.checked)}
                                    />
                                    <Sparkles size={16} />
                                    <span>Regenerated</span>
                                </label>
                            </div>
                            <div
                                ref={seekBarRef}
                                className="editor__seeker"
                                role="slider"
                                aria-label="Seek"
                                aria-valuenow={currentTime}
                                aria-valuemin={0}
                                aria-valuemax={transcript.duration ?? 0}
                                onPointerDown={handleSeekBarPointerDown}
                                onPointerMove={handleSeekBarPointerMove}
                                onPointerUp={handleSeekBarPointerUp}
                                onPointerLeave={handleSeekBarPointerUp}
                            >
                                <div className="editor__seeker-segments">
                                    {transcript.segments.map((seg) => {
                                        const dur = transcript.duration ?? 1;
                                        const pct = ((seg.end_time - seg.start_time) / dur) * 100;
                                        const color = getSpeakerColor(seg.speaker_id);
                                        return (
                                            <div
                                                key={seg.id}
                                                className="editor__seeker-segment"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: `${color}40`,
                                                    borderBottom: `2px solid ${color}`,
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                                <div
                                    className="editor__seeker-playhead"
                                    style={{ left: `${transcript.duration ? (currentTime / transcript.duration) * 100 : 0}%` }}
                                    aria-hidden
                                />
                            </div>
                        </>
                    ) : (
                        <div className="editor__player-unavailable">
                            <Clock size={18} />
                            <span>Audio not available</span>
                        </div>
                    )}
                </div>

                {/* Only this area scrolls; player above stays fixed */}
                <div className="editor__transcript-area">
                    <div className="editor__segments-panel">
                        <div className="editor__segments">
                            {filteredSegments?.map((segment) => {
                                const label = transcript.speaker_labels.find(l => l.speaker_id === segment.speaker_id);

                                return (
                                    <TranscriptSegment
                                        key={segment.id}
                                        ref={(el) => {
                                            if (el) segmentRefsMap.current.set(segment.id, el);
                                            else segmentRefsMap.current.delete(segment.id);
                                        }}
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
                                        isActive={segment.id === activeSegmentId}
                                        hasVoiceId={!!label?.voice_id}
                                        regeneratedAudioUrl={localRegeneratedUrl(segment.id)}
                                        onTextChange={(text) => handleSegmentTextChange(segment.id, text)}
                                        onSpeakerClick={() => label && handleSpeakerClick(label.id, getSpeakerName(segment.speaker_id))}
                                        onSeek={handleSeek}
                                        onRegenerate={() => regenerateSegmentAudio(segment.id)}
                                        onRegeneratedReady={(url) => setLocalRegeneratedUrl(segment.id, url)}
                                        onClearRegenerated={() => setLocalRegeneratedUrl(segment.id, null)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="editor__shortcuts">
                <Keyboard size={14} />
                <span>⌘Z Undo</span>
                <span>⌘⇧Z Redo</span>
                <span>⌘S Save</span>
            </div>
        </div>
    );
}
