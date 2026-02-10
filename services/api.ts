import {
  AnimationAction,
  CharacterResponse,
  AnimationInitResponse,
  AnimationStep1Response,
  AnimationStep2Response,
  AnimationStep3Response,
  GameResourcesResponse,
  DetectedObject,
  LocationData,
  UpdateLocationResponse
} from '../types';

// Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
export const FILE_BASE_URL = import.meta.env.VITE_FILE_BASE_URL || 'http://127.0.0.1:8000';
const ENABLE_LOGS = import.meta.env.VITE_ENABLE_API_LOG === 'true';

/**
 * Generic helper to handle fetch requests
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (ENABLE_LOGS) {
    console.group(`[API Request] ${endpoint}`);
    console.debug('Options:', options);
    console.groupEnd();
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    const errorBody = await response.text();
    if (ENABLE_LOGS) {
      console.error(`[API Error] ${endpoint}`, { status: response.status, body: errorBody });
    }
    // Try to parse error as JSON if possible, otherwise use text
    try {
      const errorJson = JSON.parse(errorBody);
      throw new Error(errorJson.detail || `API Error ${response.status}`);
    } catch (e) {
      throw new Error(errorBody || `API Error ${response.status}: ${response.statusText}`);
    }
  }

  const data = await response.json() as T;

  if (ENABLE_LOGS) {
    console.group(`[API Success] ${endpoint}`);
    console.debug('Response:', data);
    console.groupEnd();
  }

  return data;
}

// --- Character Services ---

export const createCharacterByFace = async (file: File, bodyFile: Blob): Promise<CharacterResponse> => {
  const formData = new FormData();
  // Backend expects 'face_image' and 'body_image' based on the error message
  formData.append('face_image', file);
  formData.append('body_image', bodyFile);

  return request<CharacterResponse>(`/character/create-by-face`, {
    method: 'POST',
    body: formData,
  });
};

export const createCharacterByPrompt = async (prompt: string): Promise<CharacterResponse> => {
  const formData = new FormData();
  formData.append('prompt', prompt);

  return request<CharacterResponse>(`/character/create-by-prompt`, {
    method: 'POST',
    body: formData,
  });
};

// --- Animation Services ---

export const initAnimationSession = async (file: File): Promise<AnimationInitResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  return request<AnimationInitResponse>(`/animation/init`, {
    method: 'POST',
    body: formData,
  });
};

export const runAnimationStep1 = async (animId: string): Promise<AnimationStep1Response> => {
  return request<AnimationStep1Response>(`/animation/${animId}/step1`, {
    method: 'POST',
  });
};

export const runAnimationStep2 = async (animId: string): Promise<AnimationStep2Response> => {
  return request<AnimationStep2Response>(`/animation/${animId}/step2`, {
    method: 'POST',
  });
};

export const runAnimationStep3 = async (animId: string, action: AnimationAction | string): Promise<AnimationStep3Response> => {
  return request<AnimationStep3Response>(`/animation/${animId}/step3?action=${encodeURIComponent(action)}`, {
    method: 'POST',
  });
};

// --- Game Services ---

export const getGameResources = async (gameId: string): Promise<GameResourcesResponse> => {
  return request<GameResourcesResponse>(`/game/${gameId}/get_resource`, {
    method: 'POST',
  });
};

export const analyzeBackgroundModel = async (
  animId: string,
  file: File,
  confidenceThreshold: number = 0.4
): Promise<DetectedObject[]> => {
  const formData = new FormData();
  formData.append('file', file);

  // Note: Using query param for configuration as per typical FastAPI pattern
  return request<DetectedObject[]>(
    `/background/${animId}/analyze/model?confidence_threshold=${confidenceThreshold}`,
    {
      method: 'POST',
      body: formData,
    }
  );
};

export const analyzeBackgroundSvg = async (
  animId: string,
  file: File,
  topK: number = 30
): Promise<DetectedObject[]> => {
  const formData = new FormData();
  formData.append('file', file);

  // Assuming /analyze/svg based on context, though prompt had duplicate path.
  // Adjusting path to likely intention.
  return request<DetectedObject[]>(
    `/background/${animId}/analyze/svg?top_k=${topK}`,
    {
      method: 'POST',
      body: formData,
    }
  );
};

export const updateCharacterLocation = async (locationData: LocationData): Promise<UpdateLocationResponse> => {
  return request<UpdateLocationResponse>(`/updateLocation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(locationData),
  });
};

export const convertTextToSpeech = async (text: string): Promise<string> => {
    console.log(`Calling TTS API for text: "${text}"`);
    // Ví dụ giả định trả về một Data URL
    // Trong thực tế, bạn sẽ fetch từ backend của mình,
    // và backend sẽ gọi Google Cloud TTS, AWS Polly, v.v.
    // và trả về audio file (có thể dưới dạng base64 hoặc đường link tạm).
    // Ở đây tôi dùng một API public nhỏ để demo
    // Bạn cần đăng ký khóa API tại voicerss.org và thay thế YOUR_VOICERSS_API_KEY
    const response = await fetch(`https://api.voicerss.org/?key=YOUR_VOICERSS_API_KEY&hl=en-us&src=${encodeURIComponent(text)}`);
    if (!response.ok) {
        throw new Error('Failed to convert text to speech');
    }
    const blob = await response.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
};
