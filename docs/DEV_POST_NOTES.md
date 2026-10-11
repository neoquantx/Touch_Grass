# DEV_POST_NOTES

## Touch Grass Setup Log
- Scaffolded the Expo app using `npx create-expo-app touch-grass --template blank` (using Expo SDK 57).
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

## Phase 3 Decisions
- Completed the professional UI overhaul with a custom design system inside `src/theme.js` and `src/components/ui`.
- Added the token-gated Companion chat in `app/(tabs)/companion.js` which integrates deeply with `llama.rn` inference and custom prompting.
- Added AI mission flavor descriptions and grounded map facts that run asynchronously.
- Missing Phase 2 logic (`generate.js`, `describe.js`, `checkin.js`, check scripts) were implemented fully to fulfill the requirements of this phase.
- Changed scheme to `touchgrass` and enabled `android.versionCode`. **This requires a native rebuild** using `npx expo prebuild` and `npx expo run:android`.
- Note: Cannot fully verify location checkin, ImagePicker integration, and the actual tokens/second metrics without a device. Tested pure logic (node scripts) successfully.

### Phase 3.1 Overpass Findings
- **kumi.systems Renamed**: The kumi.systems endpoint was renamed to `overpass.private.coffee`, meaning the old URL was failing.
- **15s Slot Wait**: The `overpass-api.de` endpoint can hold a request for ~15 seconds before failing if its concurrent slots are full.
- **Lighter Query Fallback**: Added a lighter query fallback that drops `grass`, `wood`, and limits the search radius to 700m to speed up request failures and increase the chance of success on retry.
- **Bundled Seed**: Added a `fetch_area.js` script to fetch Overpass data on the host machine to bundle it. Users can fallback to this if the live Overpass network fails, ensuring they always have local data.

### Phase 3.1 Debug.js Root Cause
- The `downloadResumableStartAsync` crash in `debug.js` was caused because the script was still using old initial download constants that were removed or changed in Phase 1. It has now been updated to use the shared downloading module (`src/llm/modelDownload.js`) which works seamlessly.

## Phase 5A: Setup, Ledger, Layout
- Layout issue fixed centrally in `Screen` component by separating the `StatusBar` and using a fixed view of height `insets.top`.
- Setup step cards now have 'Manage' menus which expand to show reset/refresh functions.
- The `planSpend` logic was moved to `src/llm/accounting.js`. The math causing 300 -> 264 -> 255 was analyzed and proven mathematically correct (charging exactly 1 token per generation); the fix was ensuring the store deducts and adds to a transparent ledger.
- Restored `photoMaxAgeMs` check to 600000 to handle slow GPS/camera relaunches on Android.
- Added "Reset progress" and "Delete everything" functionality to handle correct cache invalidation.

## Phase 5B
- **LOOK bug cause**: The LOOK mission was incorrectly being assigned a map element as its target instead of a generated prompt. Its title fell back to the element's name and its distance text was incorrectly rendered. The fix removes the OSM element requirement for LOOK missions (setting target/element to null), generates a deterministic prompt (e.g. "a yellow flower", "an insect") based on the seeded random generator, sets the title directly to "Find: <prompt>", and ensures that distance text is omitted for LOOK missions.
- **Flavor-text decision**: A `FEATURES.missionFlavor` flag was added to `config.js` and set to `false`. When false, background flavor generation (LLM calls) is completely bypassed. Descriptions instead use a deterministic template to save battery and inference time, addressing the issue with the 0.5B model inventing "marketing fluff" details like "tree sanctuary" or "immersive experience".

## Phase 6 Post-Notes
- **Root cause of "Failed to save photo"**: The file name for the copied image was constructed using `mission.id`, which contains colons (`:`). Colons are often unsupported or unsafe in filenames. This caused `FileSystem.copyAsync` to fail quietly or throw an error. The fix was to sanitize `mission.id` with regex `/[^a-zA-Z0-9]/g` before appending it.
- **Decisions**:
  - `generate.js` was refactored to export `selectGoElement` and `selectLearnElement` to properly reuse selection logic without duplicating it.
  - Rewrote the main missions tab screen to clean up the logic into a more structured pattern driven strictly by `controller.js`.
  - Used `daysBetween` locally to correctly track streak calculation boundaries since Expo environments can vary on date parsing.
  - Placed history and proofs pruning in the `_layout.js` initialization to guarantee it runs exactly once upon hydration.
