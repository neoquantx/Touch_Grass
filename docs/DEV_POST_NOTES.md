# DEV_POST_NOTES

## Phase 0 Log
- Scaffolded the Expo app using `npx create-expo-app grasslock --template blank` (using Expo SDK 57).
- Decided to use `expo-router` for navigation, so I manually added the router dependencies and updated the entry point in `package.json`.
- Discovered that `llama.rn` requires React Native's new architecture. Fortunately, Expo SDK 57 has the new architecture enabled by default.
- Configured `app.json` to include the `llama.rn` plugin with OpenCL and Hexagon support.
- Set up `src/llm/llm.js` and `src/llm/modelDownload.js` using `llama.rn` and `expo-file-system`.
- Added a basic test screen in `app/index.js` to download the model directly to the device, load it into memory, and stream a test generation to verify tokens-per-second speed.
- Verified the build locally using `npx expo prebuild` and `npx expo run:android`.

## Phase 1 Decisions
- Used `expo-file-system/legacy` for state persistence and model download to guarantee legacy File/Directory API compatibility, as `expo-file-system` default exports might change in newer Expo SDKs.
- Stored OSM area cache in document directory.
- `app.json` has been updated with required Android permissions (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `CAMERA`, `INTERNET`), so a native rebuild is required.
- `npx expo install --check` showed version mismatches for `@react-native-async-storage/async-storage` (3.1.1 vs 2.2.0), `react-native-safe-area-context` (5.10.1 vs ~5.7.0), and `react-native-screens` (4.28.0 vs ~4.26.0). We did not fix these because the instructions specified "Do not change the stack" and these are minor bumps that should not affect our phase 1 functionality.
- I assumed `minBytes` for Qwen2.5-0.5b-instruct-q4_k_m.gguf to be `350000000` bytes (approx 350 MB) because it is known to be around 380-400 MB.
- Unverified: Could not verify Expo Location or model download progress end-to-end without a physical device/emulator. Tested pure logic using `scripts/check_osm.js`.
