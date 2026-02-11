import { useNavigate } from 'react-router-dom';
import { Target, Clock, PencilLine, Download } from 'lucide-react';
import { AudioUploader } from '../components/AudioUploader';
import './HomePage.css';

export function HomePage() {
  const navigate = useNavigate();

  const handleTranscriptionComplete = (transcriptId: string) => {
    navigate(`/editor/${transcriptId}`);
  };

  return (
    <div className="home">
      <main className="home__main">
        <div className="home__intro">
          <h2>Transform your audio into editable text</h2>
          <p>
            Upload any audio file and get accurate transcriptions with speaker detection,
            timestamps, and an intuitive editing interface.
          </p>
        </div>

        <AudioUploader onTranscriptionComplete={handleTranscriptionComplete} />

        <div className="home__features">
          <div className="home__feature">
            <div className="home__feature-icon">
              <Target size={24} />
            </div>
            <h3>Speaker Detection</h3>
            <p>Automatically identifies and labels different speakers</p>
          </div>
          <div className="home__feature">
            <div className="home__feature-icon">
              <Clock size={24} />
            </div>
            <h3>Timestamps</h3>
            <p>Word-level timestamps for precise navigation</p>
          </div>
          <div className="home__feature">
            <div className="home__feature-icon">
              <PencilLine size={24} />
            </div>
            <h3>Easy Editing</h3>
            <p>Click to edit any segment with undo/redo support</p>
          </div>
          <div className="home__feature">
            <div className="home__feature-icon">
              <Download size={24} />
            </div>
            <h3>Export Options</h3>
            <p>Download as TXT, SRT subtitles, or JSON</p>
          </div>
        </div>
      </main>
    </div>
  );
}
