/**
 * Loading spinner component
 */

import './LoadingSpinner.css';

interface LoadingSpinnerProps {
    size?: 'small' | 'medium' | 'large';
    message?: string;
}

export function LoadingSpinner({ size = 'medium', message }: LoadingSpinnerProps) {
    return (
        <div className={`loading-spinner loading-spinner--${size}`}>
            <div className="loading-spinner__ring">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>
            {message && <p className="loading-spinner__message">{message}</p>}
        </div>
    );
}
