const DEFAULT_DEV_API = "http://localhost:8080";

// 실무 기본: 명시적으로 VITE_API_ROOT가 주어지지 않았다면 무조건 로컬(dev)로 붙는다.
export const API_ROOT = import.meta?.env?.VITE_API_ROOT ?? DEFAULT_DEV_API;

export const PROJECT_ID = Number(import.meta?.env?.VITE_PROJECT_ID ?? 1);
