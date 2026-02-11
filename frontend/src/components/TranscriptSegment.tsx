/**
 * Individual transcript segment component
 */

import { useState, useCallback, useRef, useEffect } from 'react';
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
    speakerId: string;
    speakerName: string;
    speakerColor: string;
    words?: Word[];
    isEdited: boolean;
    showFillerWords: boolean;
    onTextChange: (text: string) => void;
    onSpeakerClick: () => void;
}

// Format timestamp
function formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function TranscriptSegment({
    startTime,
    text,
    speakerId,
    speakerName,
    speakerColor,
    words,
    isEdited,
    showFillerWords,
    onTextChange,
    onSpeakerClick,
}: TranscriptSegmentProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Update local state when text prop changes
    useEffect(() => {
        setEditedText(text);
    }, [text]);

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

    // Render text with filler word highlighting
    const renderTextContent = () => {
        if (!words || words.length === 0 || !showFillerWords) {
            return <span>{text}</span>;
        }

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

    // Check if speaker is unnamed
    const isUnnamed = speakerName === `Speaker ${speakerId}`;

    return (
        <div className={`segment ${isEdited ? 'segment--edited' : ''}`}>
            <div className="segment__header">
                <span className="segment__timestamp">{formatTimestamp(startTime)}</span>
                <button
                    className="segment__speaker"
                    style={{
                        backgroundColor: `${speakerColor}20`,
                        color: speakerColor
                    }}
                    onClick={onSpeakerClick}
                >
                    <span className="segment__speaker-name">{speakerName}</span>
                    {isUnnamed && (
                        <span className="segment__speaker-hint" title="Name me?">
                            ❓
                        </span>
                    )}
                </button>
                {isEdited && (
                    <span className="segment__edited-badge" title="Edited">
                        ✏️
                    </span>
                )}
            </div>

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
                    <p className="segment__text" onClick={handleTextClick}>
                        {renderTextContent()}
                    </p>
                )}
            </div>
        </div>
    );
}
