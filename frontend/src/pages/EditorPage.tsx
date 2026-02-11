import { useParams, useNavigate } from 'react-router-dom';
import { TranscriptEditor } from '../components/TranscriptEditor';

export function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    navigate('/dashboard');
    return null;
  }

  const handleBack = () => {
    navigate('/dashboard');
  };

  return <TranscriptEditor transcriptId={id} onBack={handleBack} />;
}
