/**
 * Vertical audio timeline column for seeking - segment blocks match transcript, color-coded by speaker.
 * Scroll over timeline to zoom in/out.
 */

import { useCallback, useRef, useState } from 'react';
import './AudioTimelineColumn.css';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export interface TimelineSegment {
    id: string;
    start_time: number;
    end_time: number;
    speaker_id: string;
}

interface AudioTimelineColumnProps {
    duration: number;
    segments: TimelineSegment[];
    getSpeakerColor: (speakerId: string) => string;
    currentTime: number;
    onSeek: (time: number) => void;
}

export function AudioTimelineColumn({
    duration,
    segments,
    getSpeakerColor,
    currentTime,
    onSeek,
}: AudioTimelineColumnProps) {
    const stripRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [zoom, setZoom] = useState(1);

    const getTimeFromY = useCallback(
        (clientY: number): number => {
            const strip = stripRef.current;
            if (!strip || duration <= 0) return 0;
            const rect = strip.getBoundingClientRect();
            const yInView = clientY - rect.top;
            const totalHeight = strip.scrollHeight;
            const yInStrip = strip.scrollTop + yInView;
            const fraction = Math.max(0, Math.min(1, totalHeight > 0 ? yInStrip / totalHeight : 0));
            return fraction * duration;
        },
        [duration]
    );

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setZoom((z) => {
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta));
        });
    }, []);

    const handlePointerDown = useCallback(
        (e: React.PointerEvent) => {
            e.preventDefault();
            onSeek(getTimeFromY(e.clientY));
            setIsDragging(true);
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        },
        [getTimeFromY, onSeek]
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!isDragging) return;
            e.preventDefault();
            onSeek(getTimeFromY(e.clientY));
        },
        [isDragging, getTimeFromY, onSeek]
    );

    const handlePointerUp = useCallback(
        (e: React.PointerEvent) => {
            if (e.pointerId !== undefined) {
                try {
                    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                } catch (_) {}
            }
            setIsDragging(false);
        },
        []
    );

    if (!duration || duration <= 0) {
        return (
            <div className="audio-timeline">
                <div className="audio-timeline__strip audio-timeline__strip--empty" />
            </div>
        );
    }

    const playheadPercent = Math.max(0, Math.min(100, (currentTime / duration) * 100));

    return (
        <div className="audio-timeline">
            <div
                ref={stripRef}
                className={`audio-timeline__strip ${isDragging ? 'audio-timeline__strip--dragging' : ''}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onWheel={handleWheel}
                role="slider"
                aria-label="Audio timeline - drag or click to seek, scroll to zoom"
                aria-valuenow={currentTime}
                aria-valuemin={0}
                aria-valuemax={duration}
            >
                <div
                    className="audio-timeline__strip-inner"
                    style={{ height: `${zoom * 100}%` }}
                >
                    <div className="audio-timeline__segments">
                        {segments.map((seg) => {
                            const heightPercent = ((seg.end_time - seg.start_time) / duration) * 100;
                            const color = getSpeakerColor(seg.speaker_id);
                            return (
                                <div
                                    key={seg.id}
                                    className="audio-timeline__segment"
                                    style={{
                                        height: `${heightPercent}%`,
                                        backgroundColor: `${color}30`,
                                        borderLeft: `3px solid ${color}`,
                                    }}
                                />
                            );
                        })}
                    </div>
                    <div
                        className="audio-timeline__playhead"
                        style={{ top: `${playheadPercent}%` }}
                        aria-hidden
                    />
                </div>
            </div>
        </div>
    );
}
