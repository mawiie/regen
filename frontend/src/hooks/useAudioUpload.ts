/**
 * Custom hook for managing audio upload and transcription
 */

import { useState, useCallback } from 'react';
import {
    uploadAudio,
    startTranscription,
    getTranscriptionStatus,
    type UploadResponse,
    type TranscriptionStatus
} from '../services/api';

export type UploadState = 'idle' | 'uploading' | 'uploaded' | 'transcribing' | 'completed' | 'error';

interface UseAudioUploadResult {
    state: UploadState;
    progress: number;
    transcriptId: string | null;
    error: string | null;
    file: File | null;
    uploadFile: (file: File) => Promise<void>;
    transcribe: (wordBoost?: string[]) => Promise<void>;
    reset: () => void;
}

export function useAudioUpload(): UseAudioUploadResult {
    const [state, setState] = useState<UploadState>('idle');
    const [progress, setProgress] = useState(0);
    const [transcriptId, setTranscriptId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);

    const uploadFile = useCallback(async (selectedFile: File) => {
        try {
            setState('uploading');
            setError(null);
            setFile(selectedFile);
            setProgress(0);

            // Upload the file
            const result: UploadResponse = await uploadAudio(selectedFile);

            setTranscriptId(result.id);
            setState('uploaded');
            setProgress(100);
        } catch (err) {
            setState('error');
            setError(err instanceof Error ? err.message : 'Upload failed');
        }
    }, []);

    const transcribe = useCallback(async (wordBoost?: string[]) => {
        if (!transcriptId) {
            setError('No file uploaded');
            return;
        }

        try {
            setState('transcribing');
            setProgress(0);
            setError(null);

            // Start transcription
            await startTranscription(transcriptId, wordBoost);

            // Poll for completion
            const pollInterval = setInterval(async () => {
                try {
                    const status: TranscriptionStatus = await getTranscriptionStatus(transcriptId);

                    setProgress(status.progress || 0);

                    if (status.status === 'completed') {
                        clearInterval(pollInterval);
                        setState('completed');
                        setProgress(100);
                    } else if (status.status === 'failed') {
                        clearInterval(pollInterval);
                        setState('error');
                        setError(status.error_message || 'Transcription failed');
                    }
                } catch (err) {
                    clearInterval(pollInterval);
                    setState('error');
                    setError(err instanceof Error ? err.message : 'Status check failed');
                }
            }, 2000); // Poll every 2 seconds

        } catch (err) {
            setState('error');
            setError(err instanceof Error ? err.message : 'Failed to start transcription');
        }
    }, [transcriptId]);

    const reset = useCallback(() => {
        setState('idle');
        setProgress(0);
        setTranscriptId(null);
        setError(null);
        setFile(null);
    }, []);

    return {
        state,
        progress,
        transcriptId,
        error,
        file,
        uploadFile,
        transcribe,
        reset,
    };
}
