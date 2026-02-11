/**
 * Main App component
 */

import { useState } from 'react';
import { Target, Clock, PencilLine, Download } from 'lucide-react';
import { AudioUploader } from './components/AudioUploader';
import { TranscriptEditor } from './components/TranscriptEditor';
import './App.css';

type View = 'upload' | 'editor';

function App() {
  const [currentView, setCurrentView] = useState<View>('upload');
  const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);

  // Handle transcription complete
  const handleTranscriptionComplete = (transcriptId: string) => {
    setActiveTranscriptId(transcriptId);
    setCurrentView('editor');
  };

  // Handle back to upload
  const handleBack = () => {
    setCurrentView('upload');
    setActiveTranscriptId(null);
  };

  return (
    <div className="app">
      {currentView === 'upload' && (
        <div className="app__upload-view">
          <header className="app__header">
            <div className="app__logo">
              <div className="app__logo-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <div className="app__logo-text">
                <h1>Regen</h1>
                <p>Audio Transcription & Editing</p>
              </div>
            </div>
          </header>

          <main className="app__main">
            <div className="app__intro">
              <h2>Transform your audio into editable text</h2>
              <p>
                Upload any audio file and get accurate transcriptions with speaker detection,
                timestamps, and an intuitive editing interface.
              </p>
            </div>

            <AudioUploader onTranscriptionComplete={handleTranscriptionComplete} />

            <div className="app__features">
              <div className="app__feature">
                <div className="app__feature-icon">
                  <Target size={24} />
                </div>
                <h3>Speaker Detection</h3>
                <p>Automatically identifies and labels different speakers</p>
              </div>
              <div className="app__feature">
                <div className="app__feature-icon">
                  <Clock size={24} />
                </div>
                <h3>Timestamps</h3>
                <p>Word-level timestamps for precise navigation</p>
              </div>
              <div className="app__feature">
                <div className="app__feature-icon">
                  <PencilLine size={24} />
                </div>
                <h3>Easy Editing</h3>
                <p>Click to edit any segment with undo/redo support</p>
              </div>
              <div className="app__feature">
                <div className="app__feature-icon">
                  <Download size={24} />
                </div>
                <h3>Export Options</h3>
                <p>Download as TXT, SRT subtitles, or JSON</p>
              </div>
            </div>
          </main>

          <footer className="app__footer">
            <p>
              Built with FastAPI, React, and AssemblyAI
            </p>
          </footer>
        </div>
      )}

      {currentView === 'editor' && activeTranscriptId && (
        <TranscriptEditor
          transcriptId={activeTranscriptId}
          onBack={handleBack}
        />
      )}
    </div>
  );
}

export default App;
