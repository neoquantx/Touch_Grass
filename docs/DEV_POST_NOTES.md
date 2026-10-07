# DEV_POST_NOTES

## Phase 0 Log
- Scaffolded the Expo app using `npx create-expo-app grasslock --template blank` (using Expo SDK 57).
- Decided to use `expo-router` for navigation, so I manually added the router dependencies and updated the entry point in `package.json`.
- Discovered that `llama.rn` requires React Native's new architecture. Fortunately, Expo SDK 57 has the new architecture enabled by default.
- Configured `app.json` to include the `llama.rn` plugin with OpenCL and Hexagon support.
- Set up `src/llm/llm.js` and `src/llm/modelDownload.js` using `llama.rn` and `expo-file-system`.
- Added a basic test screen in `app/index.js` to download the model directly to the device, load it into memory, and stream a test generation to verify tokens-per-second speed.
- Verified the build locally using `npx expo prebuild` and `npx expo run:android`.
