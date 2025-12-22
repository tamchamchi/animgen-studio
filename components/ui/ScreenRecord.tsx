// ScreenRecorderCore.tsx
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";

// Define the interface for the functions and states exposed by useImperativeHandle
export interface ScreenRecorderRef {
    start: () => Promise<void>;
    stop: () => void;
    pause: () => void;
    resume: () => void;
    getIsRecording: () => boolean;
    getIsPaused: () => boolean;
    getVideoURL: () => string | null;
}

// Define props for ScreenRecorderCore (currently empty, but good practice)
interface ScreenRecorderCoreProps {
    // Any props for the core component would go here
}

const ScreenRecorderCore = forwardRef<ScreenRecorderRef, ScreenRecorderCoreProps>((_props, ref) => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [videoURL, setVideoURL] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunks = useRef<Blob[]>([]);

    // Stream references for proper cleanup
    const screenStreamRef = useRef<MediaStream | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);

    // Function to start recording
    const startRecording = async () => {
        try {
            // Clear previous video URL and chunks when starting new recording
            setVideoURL(null);
            recordedChunks.current = [];

            // Capture screen video
            const screenStream: MediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true, // Capture screen audio if available
            });
            screenStreamRef.current = screenStream; // Store stream for cleanup

            // Capture microphone audio
            const audioStream: MediaStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            audioStreamRef.current = audioStream; // Store stream for cleanup

            // Combine screen and microphone audio streams
            const combinedStream = new MediaStream();
            screenStream.getVideoTracks().forEach((track: MediaStreamTrack) => combinedStream.addTrack(track));
            screenStream.getAudioTracks().forEach((track: MediaStreamTrack) => combinedStream.addTrack(track));
            audioStream.getAudioTracks().forEach((track: MediaStreamTrack) => combinedStream.addTrack(track));

            // Initialize MediaRecorder
            const mediaRecorder = new MediaRecorder(combinedStream);
            mediaRecorderRef.current = mediaRecorder;

            // Collect video chunks
            mediaRecorder.ondataavailable = (event: BlobEvent) => {
                if (event.data.size > 0) recordedChunks.current.push(event.data);
            };

            // Stop recording
            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks.current, { type: "video/webm" });
                const url = URL.createObjectURL(blob);
                setVideoURL(url);
                recordedChunks.current = [];

                // --- TỰ ĐỘNG TẢI VIDEO VỀ KHI DỪNG ---
                const a = document.createElement("a");
                a.href = url;
                a.download = `screen-recording-${new Date().toISOString()}.webm`; // Tên file động
                document.body.appendChild(a);
                a.click(); // Kích hoạt sự kiện click để tải xuống
                document.body.removeChild(a); // Xóa thẻ 'a' khỏi DOM
                // ------------------------------------

                // Clean up streams after recording stops
                screenStreamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                audioStreamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                screenStreamRef.current = null;
                audioStreamRef.current = null;
            };

            mediaRecorder.start();
            setIsRecording(true);

            // Stop when user stops screen sharing
            // Ensure the track exists before attaching onended
            const screenVideoTrack = screenStream.getVideoTracks()[0];
            if (screenVideoTrack) {
                screenVideoTrack.onended = () => {
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                        stopRecording();
                    }
                };
            }

        } catch (error) {
            console.error("Error accessing screen or microphone:", error);
            alert("Please allow permissions for both screen and microphone.");
            setIsRecording(false); // Reset recording state on error
            // Clean up any partial streams
            screenStreamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            audioStreamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            screenStreamRef.current = null;
            audioStreamRef.current = null;
        }
    };

    // Pause recording
    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
        }
    };

    // Resume recording
    const resumeRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
        }
    };

    // Stop recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
            // The onstop event handler will now manage stream cleanup and download
        } else {
            // If not active, ensure streams are still stopped
            screenStreamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            audioStreamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            screenStreamRef.current = null;
            audioStreamRef.current = null;
        }
    };

    // Expose functions to parent component via ref
    useImperativeHandle(ref, () => ({
        start: startRecording,
        stop: stopRecording,
        pause: pauseRecording,
        resume: resumeRecording,
        getIsRecording: () => isRecording,
        getIsPaused: () => isPaused,
        getVideoURL: () => videoURL,
    }));

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Ensure all streams are stopped if component unmounts while recording
            stopRecording();
            // Revoke any created URL objects to free memory
            if (videoURL) {
                URL.revokeObjectURL(videoURL);
            }
        };
    }, [videoURL]); // Add videoURL to dependency array for revokeObjectURL

    return (
        <div className="flex flex-col items-center justify-center bg-gray-100 p-4">
            {/* Video Preview */}
            {videoURL && (
                <div className="w-full max-w-3xl mt-6">
                    <h2 className="text-lg font-semibold mb-2">Recorded Video:</h2>
                    <video src={videoURL} controls className="w-full rounded-lg shadow-lg" />
                    {/* Liên kết download thủ công vẫn còn, nhưng video sẽ tự động tải về */}
                    <a
                        href={videoURL}
                        download={`screen-recording-${new Date().toISOString()}.webm`}
                        className="mt-2 inline-block text-blue-500 underline"
                    >
                        Download Video Manually
                    </a>
                </div>
            )}
            {isRecording && <p className="text-sm text-gray-600 mt-2">Recording... Press ESC to stop sharing.</p>}
            {isPaused && <p className="text-sm text-gray-600 mt-2">Recording Paused.</p>}
        </div>
    );
});

export default ScreenRecorderCore;