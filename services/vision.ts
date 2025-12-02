// Using ESM import from CDN to ensure WASM assets load correctly without complex bundler config
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm";

let handLandmarker: HandLandmarker | null = null;
let isVideoPlaying = false;

export const initializeHandLandmarker = async () => {
  if (handLandmarker) return handLandmarker;

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 1
  });

  return handLandmarker;
};

export const startWebcam = async (videoElement: HTMLVideoElement) => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Browser API navigator.mediaDevices.getUserMedia not available");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  });

  videoElement.srcObject = stream;
  
  return new Promise<void>((resolve) => {
    videoElement.addEventListener("loadeddata", () => {
      videoElement.play();
      isVideoPlaying = true;
      resolve();
    });
  });
};

export const detectHand = (videoElement: HTMLVideoElement) => {
  if (!handLandmarker || !isVideoPlaying) return null;
  
  // MediaPipe requires a timestamp
  const startTimeMs = performance.now();
  const result = handLandmarker.detectForVideo(videoElement, startTimeMs);

  if (result.landmarks && result.landmarks.length > 0) {
    // Return the tip of the index finger (Landmark 8)
    // Landmarks are normalized [0, 1]
    return result.landmarks[0][8];
  }
  return null;
};
