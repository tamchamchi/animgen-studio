import bodyCasualRed from './assets/1.png';
import bodyRaincoat from './assets/2.png';
import bodyOverallsBrown from './assets/3.png';
import bodyDressPink from './assets/4.png';
import bodyPrincess from './assets/10.png';
import bodyAstronaut from './assets/8.png';
import bodyOverallsDenim from './assets/6.png';
import bodyHero from './assets/7.png';
import bodyStreetwear from './assets/9.png';

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
  SPEAK = 'speaking'
}

export const BODY_TEMPLATES = [
  {
    id: 'casual_red',
    name: 'Red Sweater',
    src: bodyCasualRed
  },
  {
    id: 'overalls_brown',
    name: 'Brown Overalls',
    src: bodyOverallsBrown
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
    id: 'overalls_denim',
    name: 'Denim Overall Dress',
    src: bodyOverallsDenim
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
    name: 'Boy Phố',
    src: bodyStreetwear
  },
];

export interface DetectedObject {
  label: string;
  polygon?: number[][]; // [[x1, y1], [x2, y2], ...]
}

export interface GameResourcesResponse {
  background_url?: string;
  detected_objects?: DetectedObject[];
  action_gif_urls?: string[]; // Changed from single url to list of strings
  [key: string]: any; 
}
