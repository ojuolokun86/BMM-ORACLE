import sys
import whisper

def transcribe_audio(audio_path):
    try:
        model = whisper.load_model("base")  # Use "base" model; change to "tiny", "medium", or "large" if needed
        result = model.transcribe(audio_path)
        print(result["text"])  # Output the transcription
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python whisper_transcribe.py <audio_file_path>")
    else:
        audio_file_path = sys.argv[1]
        transcribe_audio(audio_file_path)