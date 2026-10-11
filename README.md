# Touch Grass 🌱

> **An offline-first, local-AI powered mobile companion that turns neighborhood walks into a gamified, privacy-preserving exploration adventure.**

---

## Table of Contents

- [Project Overview](#project-overview)
  - [The Problem](#the-problem)
  - [The Solution](#the-solution)
  - [Target Audience](#target-audience)
  - [Key Highlights](#key-highlights)
  - [How It Works](#how-it-works)
- [Visual Preview and Screenshots](#visual-preview-and-screenshots)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
  - [System and Runtimes](#system-and-runtimes)
  - [Hardware and Device Requirements](#hardware-and-device-requirements)
  - [Network Requirements](#network-requirements)
- [Project Directory Structure](#project-directory-structure)
- [Installation and Setup Guide](#installation-and-setup-guide)
  - [Step 1: Clone and Navigate](#step-1-clone-and-navigate)
  - [Step 2: Install Node Dependencies](#step-2-install-node-dependencies)
  - [Step 3: Run Validation Tests](#step-3-run-validation-tests)
  - [Step 4: Prebuild Native Code](#step-4-prebuild-native-code)
  - [Step 5: Zero-Configuration Environment](#step-5-zero-configuration-environment)
  - [Step 6: Complete the On-Device Setup Wizard](#step-6-complete-the-on-device-setup-wizard)
- [Running the Project](#running-the-project)
  - [Development Commands](#development-commands)
  - [Targeting Android](#targeting-android)
  - [Targeting iOS (macOS Only)](#targeting-ios-macos-only)
  - [Running Tests and Verification Scripts](#running-tests-and-verification-scripts)
  - [Hardware Diagnostics and Speed Test](#hardware-diagnostics-and-speed-test)
- [Application Architecture and Workflow](#application-architecture-and-workflow)
  - [Architecture Diagram](#architecture-diagram)
  - [Data and Execution Flow](#data-and-execution-flow)
  - [Core Subsystems](#core-subsystems)
- [Dependencies and Configuration](#dependencies-and-configuration)
  - [Key Dependencies](#key-dependencies)
  - [Configuration Settings (`src/config.js`)](#configuration-settings-srcconfigjs)
  - [Local Storage and Data Persistence](#local-storage-and-data-persistence)
- [Common Errors and Troubleshooting](#common-errors-and-troubleshooting)
- [What to Avoid](#what-to-avoid)
- [Development and Contribution Workflow](#development-and-contribution-workflow)
  - [Adding or Customizing Missions](#adding-or-customizing-missions)
  - [Adding Custom AI Personas](#adding-custom-ai-personas)
  - [Pre-Commit Quality Checks](#pre-commit-quality-checks)
- [License and Additional Resources](#license-and-additional-resources)

---

## Project Overview

**Touch Grass** (internal package name: `grasslock`) is a cross-platform mobile application designed to disconnect people from screen fatigue and reconnect them with physical nature and their local neighborhoods.

### The Problem

Modern living encourages sedentary, screen-heavy habits. Existing gamified fitness applications often suffer from significant drawbacks:
1. **Surveillance and Cloud Telemetry**: Continuous GPS tracking and camera uploads are sent to third-party cloud servers.
2. **Mandatory Connectivity**: Apps fail immediately when hiking in remote parks, entering canyons, or walking in areas with poor cellular reception.
3. **Cloud AI Dependency**: Conversational companions rely on remote API services (OpenAI, Anthropic, Google), requiring paid subscriptions, developer API keys, and constant network bandwidth.

### The Solution

**Touch Grass operates 100% offline and on-device.** 

The application utilizes **OpenStreetMap (OSM)** data to discover parks, gardens, heritage monuments, fountains, and notable trees within walking distance. It generates daily outdoor missions requiring physical movement and photography. Completed missions award in-app tokens, which in turn unlock a **built-in on-device Large Language Model (Qwen2.5-0.5B-Instruct)** running entirely on your phone's processor via `llama.rn` (llama.cpp engine).

### Target Audience

- **Remote Workers and Developers**: Looking for a compelling, gamified incentive to leave the desk and get daylight outdoors.
- **Privacy-Conscious Explorers**: Users who refuse to have their location history, photos, or chat logs uploaded to remote servers.
- **Open-Source and AI Enthusiasts**: Developers interested in cutting-edge on-device LLM inference using React Native and modern mobile hardware.

### Key Highlights

- **100% Offline-First (Airplane Mode Ready)**: Uses the network **once** during initial setup to download the quantized AI model weights (~469 MB) and cache a 1,000m radius of OpenStreetMap data. From that point forward, zero internet connection is required.
- **Grounded On-Device AI Companion**: Powered by `llama.rn`, the localized 0.5-billion parameter model (`Qwen2.5-0.5B-Instruct-GGUF`) runs directly on your device CPU/GPU. To prevent AI hallucinations, summaries and dialogue are grounded exclusively in real OpenStreetMap tags from the places you physically visited.
- **Token-Gated Economy**: Chatting with the AI requires tokens. Tokens cannot be purchased; they must be earned by physically walking (100 tokens per 250m) and completing outdoor missions. Each token generated by the model consumes 1 earned token.
- **Three Daily Mission Archetypes**:
  - `GO`: Walk to a designated park, garden, or forest within a strict geofenced GPS radius (60m).
  - `LOOK`: Outdoor scavenger hunt prompt (e.g., "a textured leaf", "a yellow flower", "an insect") verified through camera capture.
  - `LEARN`: Discover historic monuments, heritage spots, or notable trees, check in on-site, and read grounded map facts.
- **Sensory Anti-Cheat & GPS Quality Filters**: High-accuracy GPS validation rejects mocked locations, filters GPS drift (<25m accuracy required), and discards speeds over 4.2 m/s (15.1 km/h) to prevent vehicular spoofing.
- **Field Journal & Scrapbook**: Completed outdoor missions are automatically recorded into an Explorer's Field Journal with photos, timestamps, verified map coordinates, and user observation notes.
- **Achievements & Badges**: 9 unique unlockable "Grass Badges" (First Step, 5K Wanderer, 25K Explorer, Eagle Eye, Local Historian, Arborist, Century Club, Week Warrior, and Golden Hour Explorer).

### How It Works

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STEP 1: ONE-TIME SETUP                          │
│  • Grant GPS & Camera permissions                                      │
│  • Download quantized Qwen2.5-0.5B GGUF weights (~469 MB) over Wi-Fi   │
│  • Cache 1 km local OpenStreetMap area (or use offline bundled seed)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        STEP 2: DAILY MISSIONS                          │
│  • Deterministic generation: Date string seeds today's 3 missions      │
│  • Slots: GO (Green Space), LOOK (Scavenger), LEARN (Heritage / Tree)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    STEP 3: OUTDOOR EXPLORATION                         │
│  • Walk tracking accumulates distance (+100 tokens / 250m)             │
│  • GPS geofence validates arrival within 60m radius of landmark        │
│  • Camera captures on-site proof photo with EXIF analysis              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    STEP 4: REWARD & AI COMPANION                       │
│  • Earn tokens: GO (+500), LOOK (+300), LEARN (+700), Walk (+100/250m) │
│  • Unlock Badges & build Field Journal history                         │
│  • Spend tokens chatting with on-device AI Companion (1 token/token)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Visual Preview and Screenshots

Project screenshots belong in the dedicated repository directory:

```text
docs/screenshots/
```

### Adding Screenshots to the Repository

To add screenshots:
1. Capture images from a physical device or emulator running Touch Grass.
2. Save the images in `docs/screenshots/` using lowercase, hyphenated filenames.
3. Link the images into this section using relative Markdown paths.

Recommended screenshot filenames for the 5 application tabs:

| Tab | Target File | What to Capture |
|---|---|---|
| **Today** | `docs/screenshots/today.png` | Active GO, LOOK, and LEARN mission cards, live walk status, and daily progress targets. |
| **Journal** | `docs/screenshots/journal.png` | Field Journal scrapbook displaying nature discoveries, photo proof thumbnails, and field notes. |
| **History** | `docs/screenshots/history.png` | 14-day activity chart, 8-metric lifetime summary grid, and unlocked Grass Badges. |
| **Companion** | `docs/screenshots/companion.png` | Offline on-device AI chat conversation, persona selection, and live token balance. |
| **Setup** | `docs/screenshots/setup.png` | Setup wizard showing granted permissions, downloaded AI model (~469 MB), and cached map area. |

> [!NOTE]
> Save your images as PNG format in `docs/screenshots/`. Once added and committed to Git, they will be tracked and viewable in the repository.

---

## Technology Stack

| Technology | Verified Version | Purpose in this Project |
|---|---|---|
| **React Native** | `0.86.3` | Cross-platform mobile application runtime using the New Architecture (Fabric renderer & TurboModules). |
| **React** | `19.2.3` | Core UI component model and declarative state rendering. |
| **Expo SDK** | `~57.0.27` | Managed development toolchain, native project prebuild, and device runtime management. |
| **Expo Router** | `^57.0.25` | File-based routing, nested tabs, and screen transitions (`app/` directory). |
| **llama.rn** | `^0.13.0-rc.7` | C++ bindings for `llama.cpp` in React Native, executing on-device GGUF inference directly on mobile hardware. |
| **Qwen2.5-0.5B-Instruct-GGUF** | `q4_k_m` (~469 MB) | Quantized 0.5B parameter language model downloaded from Hugging Face for private, offline conversation. |
| **OpenStreetMap / Overpass API** | REST API v0.6 | Geospatial data source querying leisure parks, historic monuments, artwork, and natural landmarks. |
| **Zustand** | `^5.0.15` | Reactive client state management with schema versioning (`version: 5`) and migration handlers. |
| **expo-file-system** | `^57.0.7` | Persistent storage for model weights, cached OSM JSON payloads, proof photos, and JSON state files. |
| **expo-location** | `^57.0.20` | Real-time GPS location tracking, accuracy filtering, and physical geofence calculations. |
| **expo-image-picker** | `^57.0.20` | On-site camera capture with EXIF extraction for proof photos. |
| **expo-keep-awake** | `~57.0.2` | Prevents device screen sleep during active outdoor walking sessions. |
| **Node.js Test Runner** | Node.js `>= 18` | Custom offline verification suite validating import integrity, spatial math, accounting, and grounding logic. |

---

## Prerequisites

Before setting up Touch Grass, ensure your development machine meets the following requirements:

### System and Runtimes

- **Node.js**: `v18.x` or `v20.x` LTS (tested and verified with Node 20+).
- **Package Manager**: `npm` (version `9.x` or `10.x`). Use `npm` to adhere to the repository's `package-lock.json`.
- **Git**: Installed and available on your system path.
- **Java Development Kit (JDK)**: JDK 17 (required by React Native 0.86+ and Android Gradle Plugin).

### Hardware and Device Requirements

Because Touch Grass utilizes native C++ bindings (`llama.rn`), camera hardware, and GPS sensors:

- **Expo Go is NOT supported**: You must use a local build environment (`npx expo run:android` or `npx expo run:ios`) or a custom development client.
- **Android Target**:
  - Android Studio with Android SDK Platform 34 or 35 and Android NDK installed.
  - Physical Android device (recommended) with Developer Options and USB Debugging enabled, OR an Android Emulator configured with camera and location support.
- **iOS Target (macOS Only)**:
  - macOS machine with Xcode 15+ and CocoaPods installed.
  - iOS Simulator or physical iPhone with Developer Mode enabled.
- **Storage**: At least **1.5 GB** free storage on the target device (app installation + 469 MB model weights + map cache + photos).
- **Device RAM**: Minimum **3 GB RAM** recommended on the mobile device to allocate memory for the 0.5B LLM context without being terminated by the OS low-memory killer.

### Network Requirements

- An active internet connection is required **only** during initial installation and the one-time on-device setup (to download the 469 MB GGUF model and fetch the local map area).
- Once setup is complete, the application functions with zero internet access (fully compatible with Airplane Mode).

---

## Project Directory Structure

```text
touch-grass/                               # Repository root
├── android/                               # Prebuilt native Android project (C++20, Hermes, New Architecture)
├── app/                                   # File-based navigation routes (Expo Router)
│   ├── _layout.js                         # Root stack navigation, error boundary, proof file pruning
│   ├── debug.js                           # Hardware diagnostics, LLM thread benchmark, camera EXIF test
│   └── (tabs)/                            # Primary five-tab application navigation
│       ├── _layout.js                     # Bottom tab bar configuration and reward toasts
│       ├── index.js                       # "Today" tab: Active missions, live walk card, streak milestone
│       ├── journal.js                     # "Journal" tab: Field scrapbook, photo proof viewer, observation notes
│       ├── history.js                     # "History" tab: 14-day bar chart, 8-metric grid, Grass Badges
│       ├── companion.js                   # "Companion" tab: Token-gated on-device AI chat with personas
│       └── setup.js                       # "Setup" tab: Permission wizard, model downloader, map area cache
├── assets/                                # Application icons, adaptive icons, and splash assets
├── docs/                                  # Project documentation
│   └── screenshots/                       # Dedicated directory for application screenshots
│       └── .gitkeep
├── scripts/                               # Automated offline test scripts run via npm test
│   ├── check_accounting.js                # Validates token spending and ledger deductions
│   ├── check_badges.js                    # Tests bearing calculations and badge evaluation rules
│   ├── check_grounding.js                 # Verifies LLM grounding rules and hallucination barriers
│   ├── check_imports.js                   # Scans source files to verify module imports and exports
│   ├── check_journal_toast.js             # Validates journal note synchronization and toast queue
│   ├── check_missions.js                  # Tests deterministic mission generation and slot rotation
│   ├── check_osm.js                       # Tests Haversine distance, coordinate offsets, and Overpass parser
│   └── check_progress.js                  # Tests date formatting, ISO week keys, and streak logic
├── src/                                   # Application source code and core logic
│   ├── components/                        # Reusable React Native UI components
│   │   ├── MissionCard.js                 # Interactive card for GO, LOOK, and LEARN missions
│   │   ├── ProofModal.js                  # Full-screen modal for reviewing submitted photo proofs
│   │   ├── TokenBadge.js                  # Header pill displaying current live token balance
│   │   ├── WalkCard.js                    # Live walking session card with start/pause/stop controls
│   │   └── ui/                            # Design system primitives (Button, Card, Chip, Notice, etc.)
│   ├── config.js                          # Central configuration constants (LLM, rewards, thresholds)
│   ├── theme.js                           # Theme tokens (colors, typography, spacing, border radii)
│   ├── data/                              # Bundled offline fallback datasets
│   │   ├── area_seed.json                 # Pre-fetched offline OSM seed for zero-network testing
│   │   └── sample_osm.json                # Synthetic spatial landmarks for testing
│   ├── llm/                               # Local AI integration layer
│   │   ├── accounting.js                  # Token spend planning and ledger deduction mechanics
│   │   ├── grounding.js                   # Verification logic ensuring LLM outputs match factual tags
│   │   ├── llm.js                         # llama.rn context initialization, generation, and cleanup
│   │   ├── modelDownload.js               # Resumable GGUF model download and integrity validation
│   │   ├── prompts.js                     # System prompts, persona definitions, and mission grounding context
│   │   └── queue.js                       # Mutex queue preventing concurrent LLM calls
│   ├── location/                          # Location services and sensor management
│   │   └── checkin.js                     # GPS geofence validation, mock check, pending camera recovery
│   ├── missions/                          # Mission generation and lifecycle controllers
│   │   ├── controller.js                  # Mission rotation, completion handlers, and rollover logic
│   │   ├── describe.js                    # Category labels and geofence radii definitions
│   │   ├── flavor.js                      # Background mission flavor generation
│   │   ├── generate.js                    # Seeded pseudorandom selection of GO, LOOK, and LEARN missions
│   │   ├── next.js                        # Slot replacement logic for completed or skipped missions
│   │   └── proofFlow.js                   # State machine managing photo submission flow
│   ├── osm/                               # OpenStreetMap integration
│   │   ├── cache.js                       # FileSystem caching of normalized area elements
│   │   ├── overpass.js                    # Overpass QL query builder and element normalizer
│   │   ├── overpassClient.js              # Multi-endpoint resilient fetcher with exponential timeout
│   │   └── sample.js                      # Synthetic landmark generator for sandbox testing
│   ├── progress/                          # Gamification and activity tracking
│   │   ├── badges.js                      # Badge definitions and milestone evaluation engine
│   │   ├── bonuses.js                     # Idempotent bonus reward calculation
│   │   ├── distance.js                    # Kalman/Haversine GPS fix accumulator and speed filter
│   │   ├── streak.js                      # Daily streak calculation with date boundary handling
│   │   └── walkController.js              # Background/foreground walking session controller
│   ├── store/                             # State management
│   │   ├── migrate.js                     # State schema migrations across versions
│   │   └── useStore.js                    # Primary Zustand store persisted to FileSystem
│   └── utils/                             # Helper utilities
│       ├── confirm.js                     # Double-confirmation safety dialogue helper
│       ├── date.js                        # Date normalization, ISO week keys, and date math
│       ├── eventLog.js                    # In-memory diagnostic event logging
│       ├── format.js                      # Metric formatting (distance, steps, time)
│       ├── geo.js                         # Haversine formula and compass bearing calculations
│       └── photo.js                       # Image validation, brightness checks, and EXIF readers
├── app.json                               # Expo app configuration, permissions, and native plugins
├── babel.config.js                        # Babel compiler configuration
├── package.json                           # Project manifests, dependencies, and test scripts
├── package-lock.json                      # Deterministic npm dependency lockfile
└── LICENSE                                # MIT License file
```

---

## Installation and Setup Guide

Follow these steps sequentially to set up the project on your development machine.

### Step 1: Clone and Navigate

Clone the repository and enter the project directory:

```bash
# Clone the repository
git clone https://github.com/neoquantx/Touch_Grass.git

# Navigate into the project root
cd Touch_Grass
```

### Step 2: Install Node Dependencies

Install the locked npm dependencies:

```bash
# Working directory: repository root
npm install
```

Expected output: `npm` installs packages matching `package-lock.json` and creates `node_modules/` without peer dependency conflicts.

### Step 3: Run Validation Tests

Before building native binaries, run the comprehensive offline test suite to verify module imports, spatial calculations, and state logic:

```bash
# Working directory: repository root
npm test
```

Expected output: All 8 test suites pass:
```text
All imports OK
check_osm.js PASSED
ALL check_progress.js tests PASSED!
PASS: All mission checks passed.
ALL check_badges.js tests PASSED!
check_accounting.js PASSED
ALL check_journal_toast.js tests PASSED!
PASS
```

### Step 4: Prebuild Native Code

Touch Grass uses native C++ code for `llama.rn` and requires React Native's New Architecture. Generate or update the native directories (`android/` and `ios/`):

```bash
# Working directory: repository root
npx expo prebuild
```

If you are developing for Android and the `android/` directory already exists in the repository, you can skip directly to running the project. If you encounter native dependency mismatches, use `npx expo prebuild --clean` to re-synchronize native wrappers cleanly.

### Step 5: Zero-Configuration Environment

**No `.env` file or API keys are needed.**

Touch Grass has zero external server dependencies, uses public OpenStreetMap Overpass mirrors, and runs LLM inference on-device. You do not need to configure Firebase, OpenAI, AWS, or any remote database.

### Step 6: Complete the On-Device Setup Wizard

Once the app launches on your phone or emulator, navigate to the **Setup** tab:

1. **Location Access**: Tap **Grant Location Permission** to enable foreground GPS tracking.
2. **On-Device AI Model**: Tap **Download AI Model (~469 MB)**. Keep the app open while the GGUF model (`qwen2.5-0.5b-instruct-q4_k_m.gguf`) downloads to local app storage.
3. **Map Area Cache**: Tap **Cache my area from OpenStreetMap**. If you are running in an environment without internet access or if Overpass servers are overloaded, tap **Use bundled area (offline seed)** to immediately load local map data.

Once all three steps indicate **Done**, the setup card displays **"Ready for Offline Walking"**. You can now turn on **Airplane Mode** and use the application completely offline.

---

## Running the Project

### Development Commands

Start the local Expo development server:

```bash
# Working directory: repository root
npm start
```

Press `a` in the terminal to target an Android device, or `i` to target an iOS simulator.

### Targeting Android

To compile and launch the application directly on a connected Android phone or active emulator:

```bash
# Working directory: repository root
npm run android
```

*Equivalent command:* `npx expo run:android`

This command invokes Gradle to compile the C++ `llama.rn` native libraries, bundles the Hermes JavaScript bytecode, installs the APK (`com.touchgrass.app`), and starts the app.

### Targeting iOS (macOS Only)

To compile and launch on an iOS Simulator or connected iPhone:

```bash
# Working directory: repository root
npm run ios
```

*Equivalent command:* `npx expo run:ios`

> [!NOTE]
> Physical devices require a free Apple Developer signing team configured in Xcode.

### Running Tests and Verification Scripts

Execute the automated test suite without launching a device emulator:

```bash
# Working directory: repository root
npm test
```

To run individual checks during focused development:

```bash
node scripts/check_osm.js         # Verify Overpass queries and spatial math
node scripts/check_missions.js    # Verify mission generator logic
node scripts/check_badges.js      # Verify badge evaluation and bearings
node scripts/check_accounting.js  # Verify token ledger rules
node scripts/check_grounding.js   # Verify AI hallucination barriers
```

### Hardware Diagnostics and Speed Test

The app includes a dedicated diagnostic screen located at `/debug`. You can access it via:
- Setup tab ➔ Tap **"Run Speed Test & Diagnostics"**
- Or navigating directly to the Diagnostics route

Features of the Diagnostics screen:
- **LLM Thread Benchmark**: Runs generation tests across 2, 3, 4, 5, and 6 CPU threads to benchmark tokens-per-second (TPS) on your specific mobile processor.
- **Camera & EXIF Inspector**: Captures a test image and displays dimensions, raw file size, and exposure/luminance values.
- **In-Memory Event Log**: Displays an event log of recent system and camera operations, with a **Share Log** button for debugging.

---

## Application Architecture and Workflow

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                            │
│                 (Expo Router Tabs & Stack Screens)                     │
│  [ Today ]     [ Journal ]     [ History ]    [ Companion ]  [ Setup ] │
└───────┬─────────────┬──────────────┬───────────────┬─────────────┬─────┘
        │             │              │               │             │
        ▼             ▼              ▼               ▼             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CONTROLLER & LOGIC LAYER                        │
│  • walkController: GPS fix accumulator, pace filter, keep-awake        │
│  • missionController: Rotation, daily rollover, completion handlers    │
│  • proofFlow & checkin: Geofence validation (60m), camera recovery     │
│  • accounting: Token spend planner (1 token/token generated)           │
│  • badges & streak: 14-day history, milestones, achievement checks     │
└───────┬────────────────────────────────────────────┬───────────────────┘
        │                                            │
        ▼                                            ▼
┌──────────────────────────────┐           ┌─────────────────────────────┐
│      LOCAL AI ENGINE         │           │   MAP & LOCATION SERVICES   │
│  • llama.rn (llama.cpp)      │           │  • Overpass API multi-mirror│
│  • Qwen2.5-0.5B GGUF Q4      │           │  • Haversine distance engine│
│  • 4-Thread CPU inference    │           │  • Category geofence bounds │
│  • Prompt grounding filter   │           │  • Speed & spoof detectors  │
└───────┬──────────────────────┘           └──────────────┬──────────────┘
        │                                                 │
        └──────────────────────┬──────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE & STORAGE LAYER                         │
│  • Zustand store with JSON migration pipeline                          │
│  • expo-file-system storage:                                           │
│    ├── state.json (Persisted app state, ledger, missions, days)        │
│    ├── area_cache.json (Normalized OpenStreetMap places)               │
│    ├── qwen2.5-0.5b-instruct-q4_k_m.gguf (Model weights)               │
│    └── proofs/ (Sanitized photo proof image files)                     │
└────────────────────────────────────────────────────────────────────────┘
```

### Data and Execution Flow

1. **Hydration & Date Rollover**: On app startup, `useStore` hydrates from `FileSystem.documentDirectory/state.json`. `app/_layout.js` executes `store.pruneHistory()` to enforce a 120-day retention policy and cleans up orphaned photo proofs older than 30 days. `controller.ensureToday()` checks if the system date has changed; if so, it archives yesterday's missions into `days[date]` and creates a new mission set.
2. **Mission Generation**: `src/missions/generate.js` hashes the current date string into an integer seed. It filters cached OSM elements, shuffles them deterministically, and selects:
   - One green space (`park`, `garden`, `forest`) for the `GO` mission.
   - One randomized outdoor scavenger prompt from `LOOK_PROMPTS` for the `LOOK` mission.
   - One landmark (`historic`, `tree`) for the `LEARN` mission.
3. **Physical Verification**:
   - For `GO`: When the user approaches the destination, `checkinLocation()` validates that GPS accuracy is under 50m, `location.mocked` is false, and Haversine distance to the landmark is `<= 60m`.
   - For `LOOK`: `takeProofPhoto()` launches the camera, verifies photo size (`> 8000 bytes`), and stores the proof in `proofs/`.
   - For `LEARN`: Validates geofence proximity, captures photo proof, and attaches grounded OpenStreetMap tags to the mission.
4. **Token Gating & In-Memory Accounting**:
   - Completing missions adds tokens (`REWARDS.GO = 500`, `REWARDS.LOOK = 300`, `REWARDS.LEARN = 700`).
   - In `app/(tabs)/companion.js`, when a message is submitted, `planSpend` chunks token deductions (20 tokens at a time) as tokens stream from the LLM. If tokens reach zero mid-generation, generation stops safely.
5. **Prompt Grounding**:
   - `src/llm/prompts.js` builds a context string containing active missions and completed landmarks with their exact factual tags.
   - `src/llm/grounding.js` inspects model output to verify that numbers and dates generated match factual tags, preventing hallucinations.

### Core Subsystems

- **Spatial Discovery & Geofencing**: Computes spherical distance via the Haversine formula (`src/utils/geo.js`). Filters and categorizes OpenStreetMap tags into standardized archetypes (`park`, `garden`, `forest`, `historic`, `artwork`, `tree`, `drinking_water`) and calculates adaptive arrival thresholds.
- **Activity & Pace Tracker**: `src/progress/walkController.js` manages foreground GPS subscriptions with `expo-location` and keeps the screen awake via `expo-keep-awake`. It accumulates valid distance fixes, calculates estimated step counts using an average 0.75m stride, filters stationary drift (<4m), and discards fixes exceeding 4.2 m/s to prevent driving abuse.
- **On-Device Inference & Mutex Queue**: `src/llm/queue.js` provides an exclusive execution lock ensuring only one LLM generation job runs at any time. `src/llm/llm.js` initializes the `llama.rn` context with 4 CPU threads, mlock memory locking, and a 2048 token context window.
- **Proof Flow & Activity Recovery**: `src/location/checkin.js` coordinates camera launches with `expo-image-picker`. On Android devices with limited RAM where the OS may terminate background activities during camera operations, Touch Grass persists pending proof tickets (`pendingProof_<id>.json`) and checks `getPendingResultAsync()` on resume to recover captured photos seamlessly.

---

## Dependencies and Configuration

### Key Dependencies

- **`llama.rn`**: Embedded React Native wrapper for `llama.cpp`. Requires C++20 and React Native New Architecture. Configured via `app.json` with OpenCL and Hexagon acceleration enabled.
- **`expo-location`**: Provides foreground GPS telemetry. Requires `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` permissions.
- **`expo-image-picker`**: Accesses device camera for physical proof captures. Requires `CAMERA` permission.
- **`zustand`**: State management with custom middleware serializing directly to `expo-file-system/legacy` storage.

### Configuration Settings (`src/config.js`)

Central app constants are configured in `src/config.js`:

```javascript
export const CONFIG = {
  PHOTO: { 
    minBytes: 8000                 // Minimum photo size to avoid corrupted captures
  },
  LLM: { 
    nThreads: 4                    // Benchmarked optimal threads for mobile CPUs (~37.8 tps)
  },
  MODEL: {
    name: 'Qwen2.5-0.5B-Instruct',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    minBytes: 350000000,           // Integrity threshold to prevent truncated model loads
    approxMB: 469
  },
  AREA: {
    radiusMeters: 1000,            // OSM cache radius around user coordinates
    maxElements: 600,              // Upper cap on cached map landmarks
    overpassEndpoints: [           // Mirrored public Overpass API endpoints
      "https://overpass-api.de/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass.private.coffee/api/interpreter"
    ],
    timeoutMs: 25000               // Timeout per endpoint before trying fallback
  },
  REWARDS: { 
    GO: 500,                       // Tokens earned for physical arrival
    LOOK: 300,                     // Tokens earned for scavenger photo
    LEARN: 700                     // Tokens earned for landmark discovery
  },
  CHECKIN: { 
    maxAccuracyMeters: 50,         // Maximum allowable GPS horizontal inaccuracy
    radiusMeters: 60,              // Geofence radius for GO and LEARN check-ins
    photoMaxAgeMs: 600000          // 10-minute maximum age for captured photo proofs
  },
  MISSIONS: { 
    slots: 3,                      // Concurrent active mission slots
    skipsPerTypePerDay: 3,         // Maximum allowed skips per mission type daily
    dailyCap: { GO: 6, LOOK: 6, LEARN: 6 }
  },
  WALK: { 
    minAccuracyM: 25,              // GPS fix filter threshold
    minSegmentM: 4,                // Minimum movement distance to register steps
    maxSpeedMps: 4.2,              // Speed filter threshold (4.2 m/s = 15.1 km/h) to filter out driving
    tokensPer250M: 100,            // 100 tokens awarded per 250 meters walked
    dailyRewardCapM: 5000          // Daily rewarded walking cap (5 km = 2,000 tokens)
  },
  GOALS: { 
    dailyDistanceM: 3000,          // 3 km daily walking target
    dailyBonus: 300,               // Bonus tokens for hitting daily target
    weeklyDistanceM: 15000,        // 15 km weekly walking target
    weeklyBonus: 1000              // Bonus tokens for hitting weekly target
  },
  SAFETY: { 
    daylightStartHour: 6,          // 6:00 AM - start of recommended walking hours
    daylightEndHour: 19            // 7:00 PM - end of recommended walking hours
  }
};
```

### Local Storage and Data Persistence

Touch Grass saves data to the application's sandboxed document directory (`FileSystem.documentDirectory`):
- `state.json`: Primary persistent store containing token balance, current missions, daily history, badges, and ledger entries.
- `area_cache.json`: Saved OpenStreetMap landmark objects for the cached 1 km radius.
- `qwen2.5-0.5b-instruct-q4_k_m.gguf`: Model weights.
- `proofs/`: JPEG proof captures saved with sanitized mission IDs (e.g., `proof_GO_2026_10_12_node_123.jpg`).

---

## Common Errors and Troubleshooting

| Problem | Likely Cause | Recommended Solution |
|---|---|---|
| **Android native build fails with C++ or CMake errors** | React Native New Architecture is disabled or CMake is missing. | Verify `newArchEnabled=true` exists in `android/gradle.properties`. Ensure Android NDK and CMake are installed via Android Studio SDK Tools. Run `npx expo prebuild --clean` before rebuilding. |
| **"All Overpass endpoints failed" during map caching** | Public Overpass servers are rate-limited or experiencing high traffic. | In the Setup tab, tap **Use bundled area (offline seed)**. This loads `src/data/area_seed.json` immediately with zero network requests. |
| **Check-in fails: "GPS accuracy too low"** | Phone is indoors or GPS signal is obstructed (accuracy > 50m). | Move outdoors with clear view of the sky. In an Android emulator, open Extended Controls (three dots) ➔ **Location** ➔ set GPS accuracy to `1m`. |
| **Check-in fails: "Mocked locations are not allowed"** | A mock location app or developer mock setting is active on Android. | Disable mock location providers in Android Developer Options. Physical sensor validation requires genuine hardware fixes. |
| **Model download hangs or fails with "Truncated file"** | Unstable network connection or phone ran out of disk space during download. | Ensure at least 1 GB of free storage. Tap **Manage Model** in Setup to delete any incomplete partial file (`.part`), then re-tap **Download AI Model**. |
| **AI Companion displays "Companion is locked"** | Token balance is 0. | Tokens are required to run on-device inference. Complete an active mission (GO, LOOK, or LEARN) or walk 250 meters with the walk tracker running to earn tokens. |
| **Camera fails or closes without saving photo** | Camera permission denied or OS killed background activity on low RAM. | Tap **Manage Permissions** in Setup to verify camera permissions. In low-memory scenarios, Touch Grass includes a pending proof recovery mechanism: reopening the app recovers the image automatically. |
| **Metro bundler fails: "Port 8081 already in use"** | Stale Metro process or another local server is bound to port 8081. | Run `npx expo start --port 8082`, or terminate the existing process: `lsof -ti :8081 \| xargs kill -9`. |
| **App crashes on startup with "Corrupt state file"** | `state.json` was improperly modified or written mid-shutdown. | Touch Grass automatically detects corrupt JSON, falls back to safe initial defaults, and displays a recovery banner. To reset manually, tap **Reset progress** in the Setup screen. |

---

## What to Avoid

To prevent build failures, broken local environments, or corrupted state:

1. **Avoid running build commands from the wrong directory**: Ensure you are in the repository root where `package.json` is located before running `npm` or `npx` commands.
2. **Avoid using Expo Go**: `llama.rn` utilizes customized native C++ binaries (`llama.cpp`) that cannot run in the generic Expo Go sandboxed client. Always use native development builds (`npx expo run:android` or `npx expo run:ios`).
3. **Avoid mixing package managers**: Do not run `yarn` or `pnpm`. The repository includes a verified `package-lock.json` configured specifically for `npm`.
4. **Avoid committing model weights or partial downloads**: Do not remove `*.gguf` or `*.part` from `.gitignore`. Large binary model weights (~469 MB) should never be committed to Git.
5. **Avoid committing native build outputs**: Keep `/android/build`, `/android/app/build`, and `.cxx/` in `.gitignore`. They are generated locally by Gradle.
6. **Avoid manually editing `state.json`**: The Zustand store uses schema versioning (`version: 5`). Manual modifications to JSON files in the device storage can trigger the corruption recovery handler and reset saved tokens.
7. **Avoid bypassing GPS filters during development**: The app intentionally rejects mocked GPS locations in production. When testing on an emulator, use the emulator's built-in GPS coordinate settings rather than third-party mock location apps.

---

## Development and Contribution Workflow

### Adding or Customizing Missions

Missions are generated in `src/missions/generate.js`:
- To add new scavenger hunt targets, update the `LOOK_PROMPTS` array in `src/missions/generate.js`.
- To modify landmark categories, update `src/missions/describe.js` (`CATEGORY_LABELS` and `radiusByCategory`).
- Geofence distances are defined per category (e.g., parks: 60m, historic monuments: 50m, trees: 35m).

### Adding Custom AI Personas

To add a new companion personality:
1. Open `src/llm/prompts.js`.
2. Add an entry to the `PERSONAS` object with `id`, `name`, `icon`, `badge`, `tagline`, and `systemRole`.
3. The new persona will automatically render in the persona selection carousel in `app/(tabs)/companion.js`.

### Pre-Commit Quality Checks

Before submitting pull requests or committing code changes:

```bash
# Working directory: repository root

# 1. Run the entire offline test suite
npm test

# 2. Check for missing module imports or syntax regressions
node scripts/check_imports.js

# 3. Verify state migration logic
node scripts/check_progress.js
```

---

## License and Additional Resources

### License

Touch Grass is licensed under the **MIT License**.  
Copyright (c) 2026 Himanshu Nikam.  
See the full license text in the [LICENSE](LICENSE) file.

### Additional Resources and References

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Expo Documentation (SDK 57)](https://docs.expo.dev/)
- [llama.rn GitHub Repository](https://github.com/mybigday/llama.rn)
- [llama.cpp Project](https://github.com/ggerganov/llama.cpp)
- [Qwen 2.5 Model Family (Hugging Face)](https://huggingface.co/Qwen)
- [OpenStreetMap Overpass QL Guide](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL)
