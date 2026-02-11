/**
 * API service for backend communication
 */

import { supabase } from '../lib/supabase';

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Get the current Supabase access token for API authorization.
 */
async function getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
}

/**
 * Wrapper around fetch that automatically attaches the Authorization header.
 */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
}

// Types
export interface Transcript {
    id: string;
    filename: string;
    storage_path: string | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    duration: number | null;
    num_speakers: number;
    full_text: string | null;
    segments: Segment[];
    speaker_labels: SpeakerLabel[];
    created_at: string;
    updated_at: string;
}

export interface TranscriptListItem {
    id: string;
    filename: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    duration: number | null;
    num_speakers: number;
    created_at: string;
    updated_at: string;
}

export interface Segment {
    id: string;
    segment_index: number;
    start_time: number;
    end_time: number;
    text: string;
    original_text?: string;
    speaker_id: string;
    confidence: number;
    words: Word[];
    is_edited: boolean;
    created_at: string;
    updated_at: string;
}

export interface Word {
    text: string;
    start: number;
    end: number;
    confidence: number;
    is_filler: boolean;
}

export interface SpeakerLabel {
    id: string;
    transcript_id: string;
    speaker_id: string;
    custom_name: string | null;
    color: string;
    created_at: string;
    updated_at: string;
}

export interface UploadResponse {
    id: string;
    filename: string;
    storage_path: string;
    message: string;
}

export interface TranscriptionStatus {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number | null;
    error_message: string | null;
}

export interface ExportResult {
    content: string | object;
    filename: string;
}

// API Functions

/**
 * Upload an audio file
 */
export async function uploadAudio(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await authFetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
}

/**
 * Start transcription for an uploaded file
 */
export async function startTranscription(
    transcriptId: string,
    wordBoost?: string[]
): Promise<TranscriptionStatus> {
    const params = new URLSearchParams();
    if (wordBoost && wordBoost.length > 0) {
        params.set('word_boost', wordBoost.join(','));
    }

    const url = `${API_BASE_URL}/transcripts/${transcriptId}/transcribe${params.toString() ? '?' + params : ''}`;

    const response = await authFetch(url, {
        method: 'POST',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to start transcription');
    }

    return response.json();
}

/**
 * Get transcription status (for polling)
 */
export async function getTranscriptionStatus(
    transcriptId: string
): Promise<TranscriptionStatus> {
    const response = await authFetch(`${API_BASE_URL}/transcripts/${transcriptId}/status`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get status');
    }

    return response.json();
}

/**
 * Get list of all transcripts
 */
export async function getTranscripts(
    limit = 50,
    offset = 0
): Promise<TranscriptListItem[]> {
    const response = await authFetch(
        `${API_BASE_URL}/transcripts?limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch transcripts');
    }

    return response.json();
}

/**
 * Get a single transcript with all segments
 */
export async function getTranscript(transcriptId: string): Promise<Transcript> {
    const response = await authFetch(`${API_BASE_URL}/transcripts/${transcriptId}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch transcript');
    }

    return response.json();
}

/**
 * Update a segment's text
 */
export async function updateSegment(
    segmentId: string,
    update: { text?: string; speaker_id?: string }
): Promise<Segment> {
    const response = await authFetch(`${API_BASE_URL}/segments/${segmentId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(update),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update segment');
    }

    return response.json();
}

/**
 * Bulk update multiple segments
 */
export async function bulkUpdateSegments(
    transcriptId: string,
    updates: Array<{ id: string; text?: string; speaker_id?: string }>
): Promise<Segment[]> {
    const response = await authFetch(
        `${API_BASE_URL}/transcripts/${transcriptId}/segments/bulk`,
        {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
        }
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update segments');
    }

    return response.json();
}

/**
 * Update a speaker label (rename speaker)
 */
export async function updateSpeakerLabel(
    labelId: string,
    update: { custom_name?: string; color?: string }
): Promise<SpeakerLabel> {
    const response = await authFetch(`${API_BASE_URL}/speakers/${labelId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(update),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update speaker');
    }

    return response.json();
}

/**
 * Delete a transcript
 */
export async function deleteTranscript(transcriptId: string): Promise<void> {
    const response = await authFetch(`${API_BASE_URL}/transcripts/${transcriptId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete transcript');
    }
}

/**
 * Export transcript in various formats
 */
export async function exportTranscript(
    transcriptId: string,
    format: 'txt' | 'srt' | 'json'
): Promise<ExportResult> {
    const response = await authFetch(
        `${API_BASE_URL}/transcripts/${transcriptId}/export?format=${format}`
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to export transcript');
    }

    return response.json();
}

/**
 * Download export as file
 */
export function downloadExport(result: ExportResult): void {
    const content = typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content, null, 2);

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Get audio URL for playback
 */
export function getAudioUrl(storagePath: string): string {
    return `${API_BASE_URL}/audio/${encodeURIComponent(storagePath)}`;
}
