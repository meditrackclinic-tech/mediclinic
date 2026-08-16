import { Mic, RotateCcw, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function getSpeechRecognitionApi() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const errorMessages = {
  "not-allowed": "Microphone access was blocked. Allow microphone access in the browser and try again.",
  "no-speech": "No speech was detected. Try again and speak clearly into the microphone.",
  network: "A network error interrupted recording. Try again."
};

export function VoiceRecorder({ onTranscriptChange, onError }) {
  const SpeechRecognitionApi = useRef(getSpeechRecognitionApi()).current;
  const recognitionRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
    },
    []
  );

  if (!SpeechRecognitionApi) {
    return (
      <p className="notice voice-recorder-unsupported" role="note">
        <strong>Voice recording is not available in this browser.</strong> Type the complaint below instead.
      </p>
    );
  }

  function startRecording() {
    setError("");
    setInterimText("");

    const recognition = new SpeechRecognitionApi();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];

        if (result.isFinal) {
          finalChunk += result[0].transcript;
        } else {
          interimChunk += result[0].transcript;
        }
      }

      if (finalChunk.trim()) {
        onTranscriptChange?.(finalChunk.trim());
      }

      setInterimText(interimChunk);
    };

    recognition.onerror = (event) => {
      const messageText =
        errorMessages[event.error] || "Recording could not continue. Try again or type the complaint.";
      setError(messageText);
      onError?.(messageText);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      const messageText = "Recording could not start. Try again or type the complaint.";
      setError(messageText);
      onError?.(messageText);
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  return (
    <div className="voice-recorder">
      <div className="voice-recorder-controls">
        {!isRecording ? (
          <button className="action-small" onClick={startRecording} type="button">
            <Mic size={16} />
            Start Recording
          </button>
        ) : (
          <button className="secondary action-small" onClick={stopRecording} type="button">
            <Square size={16} />
            Stop Recording
          </button>
        )}
        {error ? (
          <button className="secondary action-small" onClick={startRecording} type="button">
            <RotateCcw size={16} />
            Retry
          </button>
        ) : null}
      </div>
      {isRecording ? (
        <p className="voice-recorder-status" role="status">
          <span className="voice-recording-indicator" aria-hidden="true" />
          Listening... {interimText}
        </p>
      ) : null}
      {error ? (
        <p className="notice voice-recorder-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
