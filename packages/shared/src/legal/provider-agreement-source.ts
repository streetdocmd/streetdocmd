// In packages/shared this re-exports the canonical provider agreement text; the sync
// script replaces it with a full copy in apps that can't import @streetdocmd/shared.
export * from "../constants/provider-agreement";
