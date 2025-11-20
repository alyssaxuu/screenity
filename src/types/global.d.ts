// Global type definitions

declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.jpeg" {
  const content: string;
  export default content;
}

declare module "*.gif" {
  const content: string;
  export default content;
}

declare module "*.webp" {
  const content: string;
  export default content;
}

declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

declare module "*.scss" {
  const content: { [className: string]: string };
  export default content;
}

declare module "*.mp4" {
  const content: string;
  export default content;
}

declare module "*.webm" {
  const content: string;
  export default content;
}

// Environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    SCREENITY_ENABLE_CLOUD_FEATURES?: string;
    SCREENITY_API_BASE_URL?: string;
    SCREENITY_APP_BASE?: string;
    SCREENITY_WEBSITE_BASE?: string;
    MAX_RECORDING_DURATION?: string;
    RECORDING_WARNING_THRESHOLD?: string;
    PORT?: string;
  }
}

