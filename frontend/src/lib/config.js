// In development mode, use the Vite proxy (configured in vite.config.js).
// In production, use the environment variable or fallback to Render.
const rawApiBase = import.meta.env.DEV 
  ? "" 
  : "https://sentria-samadhan-backend.onrender.com";

export const API_BASE = rawApiBase.endsWith('/') ? rawApiBase.slice(0, -1) : rawApiBase;
