/**
 * Custom hook for managing transcript data and editing
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
    getTranscript,
    updateSegment,
    updateSpeakerLabel,
    type Transcript,
} from '../services/api';

interface EditHistoryItem {
    segmentId: string;
    previousText: string;
    newText: string;
    timestamp: number;
}

interface UseTranscriptionResult {
    transcript: Transcript | null;
    loading: boolean;
    error: string | null;
    speakerNames: Record<string, string>;
    editHistory: EditHistoryItem[];
    canUndo: boolean;
    canRedo: boolean;
    loadTranscript: (id: string) => Promise<void>;
    updateSegmentText: (segmentId: string, text: string) => Promise<void>;
    renameSpeaker: (labelId: string, name: string) => Promise<void>;
    undo: () => void;
    redo: () => void;
    getSpeakerColor: (speakerId: string) => string;
    getSpeakerName: (speakerId: string) => string;
}

const MAX_HISTORY = 50;

export function useTranscription(): UseTranscriptionResult {
    const [transcript, setTranscript] = useState<Transcript | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});

    // Undo/Redo state
    const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoRedo = useRef(false);

    // Build speaker names map from transcript
    useEffect(() => {
        if (transcript?.speaker_labels) {
            const names: Record<string, string> = {};
            transcript.speaker_labels.forEach((label) => {
                names[label.speaker_id] = label.custom_name || `Speaker ${label.speaker_id}`;
            });
            setSpeakerNames(names);
        }
    }, [transcript?.speaker_labels]);

    const loadTranscript = useCallback(async (id: string) => {
        try {
            setLoading(true);
            setError(null);
            const result = await getTranscript(id);
            setTranscript(result);
            setEditHistory([]);
            setHistoryIndex(-1);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load transcript');
        } finally {
            setLoading(false);
        }
    }, []);

    const updateSegmentText = useCallback(async (segmentId: string, text: string) => {
        if (!transcript) return;

        // Find the segment
        const segment = transcript.segments.find((s) => s.id === segmentId);
        if (!segment || segment.text === text) return;

        // Add to history if not an undo/redo operation
        if (!isUndoRedo.current) {
            const historyItem: EditHistoryItem = {
                segmentId,
                previousText: segment.text,
                newText: text,
                timestamp: Date.now(),
            };

            setEditHistory((prev) => {
                // Remove any "future" history if we're not at the end
                const newHistory = prev.slice(0, historyIndex + 1);
                newHistory.push(historyItem);

                // Keep only last MAX_HISTORY items
                if (newHistory.length > MAX_HISTORY) {
                    newHistory.shift();
                }

                return newHistory;
            });
            setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
        }

        // Update local state optimistically
        setTranscript((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                segments: prev.segments.map((s) =>
                    s.id === segmentId ? { ...s, text, is_edited: true } : s
                ),
            };
        });

        // Update on server
        try {
            await updateSegment(segmentId, { text });
        } catch (err) {
            // Revert on error
            setTranscript((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    segments: prev.segments.map((s) =>
                        s.id === segmentId ? { ...s, text: segment.text } : s
                    ),
                };
            });
            setError(err instanceof Error ? err.message : 'Failed to save edit');
        }
    }, [transcript, historyIndex]);

    const renameSpeaker = useCallback(async (labelId: string, name: string) => {
        if (!transcript) return;

        const label = transcript.speaker_labels.find((l) => l.id === labelId);
        if (!label) return;

        // Update local state optimistically
        setSpeakerNames((prev) => ({
            ...prev,
            [label.speaker_id]: name,
        }));

        setTranscript((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                speaker_labels: prev.speaker_labels.map((l) =>
                    l.id === labelId ? { ...l, custom_name: name } : l
                ),
            };
        });

        // Update on server
        try {
            await updateSpeakerLabel(labelId, { custom_name: name });
        } catch (err) {
            // Revert on error
            setSpeakerNames((prev) => ({
                ...prev,
                [label.speaker_id]: label.custom_name || `Speaker ${label.speaker_id}`,
            }));
            setError(err instanceof Error ? err.message : 'Failed to rename speaker');
        }
    }, [transcript]);

    const undo = useCallback(() => {
        if (historyIndex < 0 || !editHistory[historyIndex]) return;

        const item = editHistory[historyIndex];
        isUndoRedo.current = true;
        updateSegmentText(item.segmentId, item.previousText);
        isUndoRedo.current = false;
        setHistoryIndex((prev) => prev - 1);
    }, [historyIndex, editHistory, updateSegmentText]);

    const redo = useCallback(() => {
        if (historyIndex >= editHistory.length - 1) return;

        const item = editHistory[historyIndex + 1];
        isUndoRedo.current = true;
        updateSegmentText(item.segmentId, item.newText);
        isUndoRedo.current = false;
        setHistoryIndex((prev) => prev + 1);
    }, [historyIndex, editHistory, updateSegmentText]);

    const getSpeakerColor = useCallback((speakerId: string): string => {
        const label = transcript?.speaker_labels.find((l) => l.speaker_id === speakerId);
        return label?.color || '#3B82F6';
    }, [transcript]);

    const getSpeakerName = useCallback((speakerId: string): string => {
        return speakerNames[speakerId] || `Speaker ${speakerId}`;
    }, [speakerNames]);

    const canUndo = historyIndex >= 0;
    const canRedo = historyIndex < editHistory.length - 1;

    return {
        transcript,
        loading,
        error,
        speakerNames,
        editHistory,
        canUndo,
        canRedo,
        loadTranscript,
        updateSegmentText,
        renameSpeaker,
        undo,
        redo,
        getSpeakerColor,
        getSpeakerName,
    };
}
