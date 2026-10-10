# Touch Grass

An offline-first, local-AI driven React Native app that encourages you to explore your neighborhood.

## What it is
Touch Grass is a gamified walking companion. It uses OpenStreetMap data to generate daily missions to walk to nearby parks, monuments, and trees. By checking in physically (via GPS) and taking proof photos, you earn tokens. These tokens unlock a built-in AI companion that lives entirely on your phone.

## Install and Build
To run this project, you need a physical device (or an emulator with camera/location mocked). No EAS build is strictly necessary for local development if you have a local build environment.

```bash
# Install dependencies
npm install

# Prebuild the native code (creates android/ and ios/ folders)
npx expo prebuild

# Run on an Android device
npx expo run:android

# Run on an iOS device (Mac only)
npx expo run:ios
```

## How it works
1. **Setup**: The app downloads a small quantized AI model (Qwen2.5-0.5B-Instruct-GGUF) and caches a 1.5 km radius of your OpenStreetMap area. This is the **only** time the app uses the internet.
2. **Missions**: Every day, the app generates up to 3 missions (GO, LOOK, LEARN) using your cached local map data.
3. **Check-in**: You walk to the physical location and check in via GPS and the Camera.
4. **Companion**: You spend tokens to chat with the on-device AI. The AI has context about the places you visited today.

## Why open innovation matters
- **On-device AI**: Powered by `llama.rn` (llama.cpp for React Native), the AI runs 100% locally.
- **Privacy First**: No server, no API keys, and your photos and location never leave your phone.
- **True Ownership**: You can only build a token-gated experience around a model you actually own and run locally.
- **Grounded Facts**: To prevent hallucinations, the local LLM is forced to summarize ONLY the factual tags downloaded from OpenStreetMap.

## Limitations
- **Image Checking**: The "LOOK" mission proof photo is not currently checked by a vision model (due to size constraints); it is an honor system.
- **Gate Bypass**: Because everything runs locally, a knowledgeable user could theoretically modify the local storage to bypass the token gate.
- **Model Size**: The 0.5B parameter model is very fast but its conversational depth is limited.
- **OSM Coverage**: The experience heavily depends on the density of OpenStreetMap tags in your local area.

## How my walk test went
[Placeholder: Notes from actual field testing of the app in the wild]

## Roadmap
Not included in Phase 6:
- Background tracking with a foreground service
- Real step counting (Health Connect)
- Notifications
- Cloud sync
- **Known issues:** `expo-keep-awake` is used as a transitive dependency of expo. It will be declared in package.json after the challenge.
