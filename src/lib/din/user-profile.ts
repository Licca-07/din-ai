export {
  SAMPLE_USER_PROFILE,
  describeUserProfile,
  ensureUserProfile,
  loadUserProfile,
  saveUserProfile,
} from "@/lib/din/memory";

/** @deprecated Use MEMORY_KEY from memory.ts */
export const USER_PROFILE_KEY = "din-ai-user-profile";
