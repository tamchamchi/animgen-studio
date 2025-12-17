import {
  AnimationAction,
  CharacterResponse,
  AnimationInitResponse,
  AnimationStep1Response,
  AnimationStep2Response,
  AnimationStep3Response,
  GameResourcesResponse,
  DetectedObject
} from '../types';

// Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
export const FILE_BASE_URL = import.meta.env.VITE_FILE_BASE_URL;

/**
 * Generic helper to handle fetch requests with Logging
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // --- LOG REQUEST ---
  // Sử dụng groupCollapsed để console gọn gàng, bấm vào mới mở ra chi tiết
  console.groupCollapsed(`🚀 API Request: [${options.method || 'GET'}] ${endpoint}`);
  console.log('🔗 URL:', url);

  // Log body đặc biệt xử lý cho FormData để nhìn thấy nội dung file/text
  if (options.body instanceof FormData) {
    console.log('📂 Body (FormData):');
    options.body.forEach((value, key) => {
      // Nếu là File thì log tên và type, nếu là string thì log giá trị
      if (value instanceof File) {
        console.log(`   - ${key}: File(name="${value.name}", type="${value.type}", size=${value.size})`);
      } else {
        console.log(`   - ${key}: "${value}"`);
      }
    });
  } else if (options.body) {
    console.log('📦 Body:', options.body);
  }

  try {
    const response = await fetch(url, options);

    // --- LOG RESPONSE ERROR ---
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ API Error ${response.status}:`, errorBody);
      console.groupEnd(); // Đóng group log

      // Try to parse error as JSON if possible, otherwise use text
      try {
        const errorJson = JSON.parse(errorBody);
        throw new Error(errorJson.detail || `API Error ${response.status}`);
      } catch (e) {
        throw new Error(errorBody || `API Error ${response.status}: ${response.statusText}`);
      }
    }

    const data = await response.json() as T;

    // --- LOG RESPONSE SUCCESS ---
    console.log(`✅ Status: ${response.status}`);
    console.log('DATA:', data);
    console.groupEnd(); // Đóng group log

    return data;

  } catch (error) {
    // --- LOG NETWORK ERROR ---
    console.error('💥 Network/Parsing Error:', error);
    console.groupEnd(); // Đóng group log
    throw error;
  }
}

// --- Character Services ---

export const createCharacterByFace = async (file: File, bodyFile: Blob): Promise<CharacterResponse> => {
  const formData = new FormData();
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

export const adjustCharacter = async (
  faceFile: File,
  bodyFile: Blob,
  params: { anchorX: number; anchorY: number; scaleW: number; scaleH: number }
): Promise<CharacterResponse> => {
  const formData = new FormData();
  formData.append('face_image', faceFile);
  formData.append('body_image', bodyFile);
  formData.append('anchor_x', Math.round(params.anchorX).toString());
  formData.append('anchor_y', Math.round(params.anchorY).toString());
  formData.append('scale_w', Math.round(params.scaleW).toString());
  formData.append('scale_h', Math.round(params.scaleH).toString());

  return request<CharacterResponse>(`/character/adjust`, {
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

// --- Background Services ---

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