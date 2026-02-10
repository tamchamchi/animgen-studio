import bodyBrownPolo from './assets/15.png';
import bodyRaincoat from './assets/2.png';
import bodyOrangeShirt from './assets/13.png';
import bodyDressPink from './assets/14.png';
import bodyPrincess from './assets/10.png';
import bodyAstronaut from './assets/8.png';
import bodyManDan from './assets/man_dan.png';
import bodyHero from './assets/7.png';
import bodyStreetwear from './assets/9.png';

import magicalGirl from './assets/magical_girl.png'
import cuteKid from './assets/kid.png'
import MU from './assets/mu.png'
import Char1 from './assets/char1.png'

// Common Types

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  [key: string]: any;
}

export interface CharacterResponse {
  id: string;
  image_url: string;
  face_url?: string;
}

export interface AnimationInitResponse {
  id: string;
  status: string;
}

export interface AnimationStep1Response {
  mask_url: string;
  texture_url: string;
}

export interface AnimationStep2Response {
  joint_yaml_url: string;
  pose_viz_url: string;
}

export interface AnimationStep3Response {
  status: string;
  action: string;
  gif_url: string;
}

export enum AnimationAction {
  STAND = 'standing',
  RUN = 'running',
  JUMP = 'jumping',
  DANCE = 'jesse_dancing',
  WAVE = 'waving',
  SPEAK = 'speaking',
  RUSSIAN_DANCE = "russian_dancing",
  CR7_SIUU = "cr7_siuu"
}

export const BODY_TEMPLATES = [
  {
    id: 'brown_polo',
    name: 'Brown Polo',
    src: bodyBrownPolo
  },
  {
    id: 'orange_shirt',
    name: 'Orange Shirt',
    src: bodyOrangeShirt
  },
  {
    id: 'dress_pink',
    name: 'Pink Dress',
    src: bodyDressPink
  },
  {
    id: 'princess',
    name: 'Princess',
    src: bodyPrincess
  },
  {
    id: 'astronaut',
    name: 'Astronaut Suit',
    src: bodyAstronaut
  },
  {
    id: 'man_dan',
    name: 'Mân Đàn',
    src: bodyManDan
  },
  {
    id: 'hero',
    name: 'Super Hero',
    src: bodyHero
  },
  {
    id: 'raincoat',
    name: 'Yellow Raincoat',
    src: bodyRaincoat
  },
  {
    id: 'streetwear',
    name: 'Phấn Bổ',
    src: bodyStreetwear
  },
];

export interface DetectedObject {
  name: string;
  polygon: [number, number][]; // [[x1, y1], [x2, y2], ...]
  id_polygon: number;
  bbox: number[] | null;
  audioUrl?: string | null;
  ttsText?: string | null;
}

export interface GameResourcesResponse {
  background_url?: string;
  detected_objects?: DetectedObject[];
  action_gif_urls?: string[]; // Changed from single url to list of strings
  [key: string]: any;
}

export const CHARACTER_TEMPLATES = [
  { id: 'tpl1', name: 'Heroic Knight', url: Char1 },
  { id: 'tpl2', name: 'Cyber Ninja', url: MU },
  { id: 'tpl3', name: 'Magical Girl', url: magicalGirl },
  { id: 'tpl4', name: 'Cute Kid', url: cuteKid },
]

export interface LocalDetectedObject {
  id: string | number;
  name: string;
  polygon: number[][];
  bbox: number[] | null;
  audioUrl?: string | null; // <-- THÊM TRƯỜNG NÀY
  ttsText?: string | null; // <-- THÊM TRƯỜNG NÀY (Để lưu trữ văn bản nếu chuyển đổi từ TTS)
}

export interface APIDetectedObject {
  id_polygon: string | number;
  name: string;
  polygon: number[][];
  bbox: number[] | null;
  audioUrl?: string | null;
  ttsText?: string | null;
}

export interface LocationData {
  id: string | number; // Union[str, int]
  name: string;
  bbox?: number[]; // Optional[List[float]]
  audio_base64?: string; // Optional[str]
  audio_format?: string; // Optional[str]
  audioUrl?: string | null;
  ttsText?: string | null;
}

export interface UpdateLocationResponse {
  success: boolean;
  message?: string;
}

export const AUDIO_PATHS = {
  RUNNING: './assets/run.mp3', // Đảm bảo đường dẫn này đúng với vị trí file của bạn
  JUMP: './assets/jump.mp3',
  LAND: './assets/land.mp3',
  DANCE: './assets/dance_music.mp3',
};