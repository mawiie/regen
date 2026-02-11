/**
 * Individual transcript segment component
 */

import { useState, useCallback, useRef, useEffect, forwardRef } from 'react';
import { Pencil, HelpCircle, RefreshCw, Play, Loader2, RotateCcw } from 'lucide-react';
import './TranscriptSegment.css';

interface Word {
    text: string;
    start: number;
    end: number;
    confidence: number;
    is_filler: boolean;
}

interface TranscriptSegmentProps {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    originalText?: string;
    speakerId: string;
    speakerName: string;
    speakerColor: string;
    words?: Word[];
    isEdited: boolean;
    showFillerWords: boolean;
    isActive?: boolean;
    hasVoiceId?: boolean;
    /** Local object URL for regenerated audio (never uploaded). */
    regeneratedAudioUrl?: string | null;
    onTextChange: (text: string) => void;
    onSpeakerClick: () => void;
    onSeek?: (time: number) => void;
    onRegenerate?: () => Promise<Blob>;
    /** Called when regenerated audio is ready; store URL locally (no Accept step). */
    onRegeneratedReady?: (blobUrl: string) => void;
    /** Clear local regenerated override for this segment (use original). */
    onClearRegenerated?: () => void;
}

// Simple word-level diff
interface DiffPart {
    type: 'added' | 'removed' | 'unchanged';
    text: string;
}

function computeWordDiff(original: string, edited: string): DiffPart[] {
    const originalWords = original.trim().split(/\s+/);
    const editedWords = edited.trim().split(/\s+/);
    
    const result: DiffPart[] = [];
    let i = 0, j = 0;
    
    while (i < originalWords.length || j < editedWords.length) {
        if (i >= originalWords.length) {
            // Only edited words remain
            result.push({ type: 'added', text: editedWords[j] });
            j++;
        } else if (j >= editedWords.length) {
            // Only original words remain
            result.push({ type: 'removed', text: originalWords[i] });
            i++;
        } else if (originalWords[i] === editedWords[j]) {
            // Words match
            result.push({ type: 'unchanged', text: originalWords[i] });
            i++;
            j++;
        } else {
            // Words differ - simple heuristic: check if next words match
            const origNextMatchesEdited = i + 1 < originalWords.length && originalWords[i + 1] === editedWords[j];
            const editedNextMatchesOrig = j + 1 < editedWords.length && editedWords[j + 1] === originalWords[i];
            
            if (origNextMatchesEdited) {
                // Original word was removed
                result.push({ type: 'removed', text: originalWords[i] });
                i++;
            } else if (editedNextMatchesOrig) {
                // Word was added
                result.push({ type: 'added', text: editedWords[j] });
                j++;
            } else {
                // Word was changed (show as removed + added)
                result.push({ type: 'removed', text: originalWords[i] });
                result.push({ type: 'added', text: editedWords[j] });
                i++;
                j++;
            }
        }
    }
    
    return result;
}

// Format timestamp
function formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const TranscriptSegment = forwardRef<HTMLDivElement, TranscriptSegmentProps>(function TranscriptSegment({
    id,
    startTime,
    text,
    originalText,
    speakerId,
    speakerName,
    speakerColor,
    words,
    isEdited,
    showFillerWords,
    isActive = false,
    hasVoiceId = false,
    regeneratedAudioUrl,
    onTextChange,
    onSpeakerClick,
    onSeek,
    onRegenerate,
    onRegeneratedReady,
    onClearRegenerated,
}, ref) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const [regenState, setRegenState] = useState<'idle' | 'loading' | 'ready' | 'playing'>('idle');
    const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    // Update local state when text prop changes
    useEffect(() => {
        setEditedText(text);
    }, [text]);

    // Cleanup preview blob URL on unmount or when leaving ready state
    useEffect(() => {
        return () => {
            if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
        };
    }, [previewBlobUrl]);

    const handleRegenerate = useCallback(async () => {
        if (!onRegenerate || !text.trim()) return;
        setRegenState('loading');
        if (previewBlobUrl) {
            URL.revokeObjectURL(previewBlobUrl);
            setPreviewBlobUrl(null);
        }
        try {
            const blob = await onRegenerate();
            const url = URL.createObjectURL(blob);
            setPreviewBlobUrl(url);
            onRegeneratedReady?.(url);
            setRegenState('ready');
        } catch {
            setRegenState('idle');
        }
    }, [onRegenerate, onRegeneratedReady, text, previewBlobUrl]);

    const handlePlayPreview = useCallback(() => {
        if (!previewBlobUrl || !previewAudioRef.current) return;
        setRegenState('playing');
        const el = previewAudioRef.current;
        el.src = previewBlobUrl;
        el.play().catch(() => setRegenState('ready'));
    }, [previewBlobUrl]);

    const handlePreviewEnded = useCallback(() => {
        setRegenState('ready');
    }, []);

    const handleUseOriginal = useCallback(() => {
        onClearRegenerated?.();
        if (previewBlobUrl) {
            URL.revokeObjectURL(previewBlobUrl);
            setPreviewBlobUrl(null);
        }
        setRegenState('idle');
    }, [onClearRegenerated, previewBlobUrl]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current && isEditing) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [editedText, isEditing]);

    // Handle text click to edit
    const handleTextClick = useCallback(() => {
        setIsEditing(true);
        setTimeout(() => {
            textareaRef.current?.focus();
            textareaRef.current?.select();
        }, 0);
    }, []);

    // Handle text change
    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setEditedText(newText);

        // Debounce the save
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            if (newText !== text) {
                onTextChange(newText);
            }
        }, 500);
    }, [text, onTextChange]);

    // Handle blur (save immediately)
    const handleBlur = useCallback(() => {
        setIsEditing(false);
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        if (editedText !== text) {
            onTextChange(editedText);
        }
    }, [editedText, text, onTextChange]);

    // Handle keyboard events
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setEditedText(text);
            setIsEditing(false);
        }
    }, [text]);

    // Handle timestamp click for seeking
    const handleTimestampClick = useCallback(() => {
        if (onSeek) {
            onSeek(startTime);
        }
    }, [onSeek, startTime]);

    // Render text with filler word highlighting
    // Note: If the text has been edited, we use the text prop directly
    // because the words array contains the original word-level data
    const renderTextContent = () => {
        // If edited, always show the edited text (words array is stale)
        if (isEdited) {
            return <span>{text}</span>;
        }
        
        // If no words or filler word highlighting is off, just show text
        if (!words || words.length === 0 || !showFillerWords) {
            return <span>{text}</span>;
        }

        // Show word-level content with filler word highlighting
        return words.map((word, idx) => (
            <span key={idx}>
                {word.is_filler ? (
                    <span className="filler-word">{word.text}</span>
                ) : (
                    word.text
                )}
                {idx < words.length - 1 ? ' ' : ''}
            </span>
        ));
    };

    // Render inline diff (similar to Grammarly)
    const renderInlineDiff = () => {
        if (!originalText || originalText === text) {
            return renderTextContent();
        }

        const diffParts = computeWordDiff(originalText, text);
        
        return (
            <>
                {diffParts.map((part, idx) => {
                    if (part.type === 'removed') {
                        return (
                            <span key={idx} className="diff-removed">
                                {part.text}
                            </span>
                        );
                    } else if (part.type === 'added') {
                        return (
                            <span key={idx} className="diff-added">
                                {part.text}
                            </span>
                        );
                    } else {
                        return <span key={idx}>{part.text}</span>;
                    }
                }).reduce((prev, curr, idx) => {
                    // Add spaces between words
                    if (idx === 0) return [curr];
                    return [...prev, ' ', curr];
                }, [] as React.ReactNode[])}
            </>
        );
    };

    // Check if speaker is unnamed
    const isUnnamed = speakerName === `Speaker ${speakerId}`;

    // Check if there's a diff to show
    const hasDiff = isEdited && originalText && originalText !== text;

    return (
        <div
            ref={ref}
            className={`segment ${isEdited ? 'segment--edited' : ''} ${isActive ? 'segment--active' : ''}`}
        >
            <div className="segment__header">
                <button 
                    className="segment__timestamp"
                    onClick={handleTimestampClick}
                    title="Click to seek to this position"
                >
                    {formatTimestamp(startTime)}
                </button>
                <button
                    className={`segment__speaker ${isUnnamed ? 'segment__speaker--unnamed' : ''}`}
                    style={{
                        backgroundColor: `${speakerColor}15`,
                        color: speakerColor
                    }}
                    onClick={onSpeakerClick}
                >
                    <span className="segment__speaker-name">{speakerName}</span>
                    {isUnnamed && (
                        <span className="segment__speaker-hint">
                            <HelpCircle size={12} />
                            <span className="segment__speaker-hint-text">Click to name</span>
                        </span>
                    )}
                </button>
                {isEdited && (
                    <span className="segment__edited-badge" title="Edited">
                        <Pencil size={14} />
                    </span>
                )}
                {hasVoiceId && onRegenerate && text.trim() && (
                    <button
                        type="button"
                        className="segment__regen-btn"
                        onClick={handleRegenerate}
                        disabled={regenState === 'loading'}
                        title="Regenerate audio with ElevenLabs"
                    >
                        {regenState === 'loading' ? (
                            <Loader2 size={14} className="segment__regen-spinner" />
                        ) : (
                            <RefreshCw size={14} />
                        )}
                        <span className="segment__regen-label">Regenerate</span>
                    </button>
                )}
            </div>

            {(regenState === 'ready' || regenState === 'playing') && (
                <div className="segment__preview-bar">
                    <button
                        type="button"
                        className="segment__preview-play"
                        onClick={handlePlayPreview}
                        disabled={regenState === 'playing'}
                    >
                        <Play size={14} />
                        {regenState === 'playing' ? 'Playing…' : 'Play'}
                    </button>
                </div>
            )}
            {regeneratedAudioUrl && onClearRegenerated && (
                <button
                    type="button"
                    className="segment__use-original-btn"
                    onClick={handleUseOriginal}
                    title="Use original audio for this segment"
                >
                    <RotateCcw size={14} />
                    <span>Use original</span>
                </button>
            )}
            <audio
                ref={previewAudioRef}
                onEnded={handlePreviewEnded}
                style={{ display: 'none' }}
            />

            <div className="segment__content">
                {isEditing ? (
                    <textarea
                        ref={textareaRef}
                        className="segment__editor"
                        value={editedText}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                ) : (
                    <p className={`segment__text ${hasDiff ? 'segment__text--with-diff' : ''}`} onClick={handleTextClick}>
                        {hasDiff ? renderInlineDiff() : renderTextContent()}
                    </p>
                )}
            </div>
        </div>
    );
});
