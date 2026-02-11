# Regen - Audio Transcription & Editing System

Transform audio files into editable transcripts with speaker detection, timestamps, and an intuitive editing interface.

## Features

- 🎯 **Speaker Detection**: Automatically identifies and labels different speakers
- ⏱️ **Word-Level Timestamps**: Precise navigation with millisecond accuracy
- ✏️ **Easy Editing**: Click to edit any segment with undo/redo support
- 🔍 **Filler Word Highlighting**: Marks "uhm", "uh", "like" for easy review
- 📤 **Export Options**: Download as TXT, SRT subtitles, or JSON

## Tech Stack

- **Backend**: FastAPI + Python
- **Frontend**: React + TypeScript + Vite
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Transcription**: AssemblyAI

## Prerequisites

- Python 3.10+
- Node.js 18+
- Supabase account
- AssemblyAI API key

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd regen
```

### 2. Configure environment variables

Create a `.env` file in the root directory:

```env
ASSEMBLY_AI_API_KEY=your_assemblyai_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

### 3. Setup Supabase

1. Create a new Supabase project
2. Run the migration SQL in `backend/database/migrations/001_initial_schema.sql`
3. Create a storage bucket called `audio-files`

### 4. Install backend dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 5. Install frontend dependencies

```bash
cd frontend
npm install
```

## Running the Application

### Start the backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

The API will be available at http://localhost:8000

### Start the frontend

```bash
cd frontend
npm run dev
```

The app will be available at http://localhost:5173

## API Endpoints

### Upload
- `POST /api/upload` - Upload an audio file
- `POST /api/transcripts/{id}/transcribe` - Start transcription

### Transcripts
- `GET /api/transcripts` - List all transcripts
- `GET /api/transcripts/{id}` - Get transcript with segments
- `GET /api/transcripts/{id}/status` - Check transcription status
- `DELETE /api/transcripts/{id}` - Delete a transcript

### Segments
- `GET /api/transcripts/{id}/segments` - Get all segments
- `PATCH /api/segments/{id}` - Update a segment

### Speakers
- `GET /api/transcripts/{id}/speakers` - Get speaker labels
- `PATCH /api/speakers/{id}` - Rename a speaker

### Export
- `GET /api/transcripts/{id}/export?format=txt|srt|json` - Export transcript

## Keyboard Shortcuts

- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Shift + Z` - Redo
- `Ctrl/Cmd + S` - Save (visual feedback only, auto-saves on edit)

## Phase 2 (Coming Soon)

- Audio regeneration with ElevenLabs
- Speaker-specific voice modifications
- "Remove filler words from Speaker X" functionality
- "Make Speaker Y sound more excited" feature
