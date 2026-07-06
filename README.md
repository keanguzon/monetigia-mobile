# Monetigia Mobile 📱

Monetigia Mobile is a premium personal finance tracking application built with React Native and Expo. It delivers 100% feature and visual parity with the Monetigia Web Application, incorporating a beautiful glassmorphic dark theme, visual line charts, transaction management, secure multi-wallet transfers, and optimized animations.

---

## Key Features & Architecture

### 1. Premium Visual Design & Polish
- **Glassmorphic Cards:** Integrated native blur and linear gradients using `expo-blur` and `expo-linear-gradient` to render premium frosted-glass UI containers.
- **Pulsing Shimmer Skeletons:** Implemented high-performance loading screens for the Dashboard, Accounts, and Transactions pages. All pulse animations run on the native GPU thread (`useNativeDriver: true`) with lifecycle cleanup to guarantee zero memory leaks or JS thread starvation.
- **Tactile Haptic Feedback:** Embedded `expo-haptics` responses across key interactive points:
  - Tab bar navigation switches (`selectionAsync`)
  - Form validation errors and successes (`notificationAsync`)
  - Button presses and list item swipes (`impactAsync`)

### 2. High-Resiliency Ledger Architecture
- **Atomic Operations:** All write actions utilize server-side Postgres RPCs to prevent data corruption due to sudden client-side network disconnects:
  - `add_transaction_atomic`: Creates a transaction and updates the associated wallet balance.
  - `delete_transaction_atomic`: Removes a transaction and atomically reverts the account balance.
  - `add_transfer_atomic`: Moves money between wallets safely using row-level locking.
- **Deadlock-Free Locking:** The transfer and deletion RPCs enforce a strictly deterministic row-locking order (sorting UUID strings alphabetically) to prevent concurrent database deadlocks.
- **Overdraft & Overpayment Protection:** Cash accounts are blocked from dipping below zero, and credit card payments are prevented from exceeding the outstanding balance.
- **ConcurrentUser Fetching:** The Transactions page implements a unique **Request ID Concurrency Tracker** and debounced fetchers. If a user quickly changes filter tabs, stale responses are automatically discarded, avoiding state desync.

### 3. Settings & Secure Logout
- **Offline Session Scrubbing:** Tapping "Sign Out" executes a secure logout routine. Even if a user loses internet connectivity, the app forcefully clears local session states (`supabase.auth.signOut({ scope: 'local' })`), wipes local cache storages, and redirects back to the login screen.

---

## Tech Stack
- **Core:** React Native, Expo (SDK 51), TypeScript
- **State & Database:** Supabase JS Client, PostgreSQL
- **Routing:** Expo Router (File-based navigation)
- **UI & Icons:** Lucide React Native, Custom GlassCard components
- **Charts:** React Native Gifted Charts

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Create a `.env` file in the root directory and configure your Supabase credentials:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run Database Migrations
Before running the app, execute the database migrations located in the root folder using the Supabase SQL Editor:
1. `supabase_delete_transaction.sql` (Atomic transaction removal)
2. `supabase_add_transfer.sql` (Safe money transfers)

### 4. Start Development Server
```bash
npx expo start
```
Use `a` to open in an Android Emulator, `i` to open in an iOS Simulator, or scan the QR code to run on a physical device via Expo Go.

---

## CI/CD and Releases
The project is configured with automated GitHub workflows:
- **Build APK and Release:** Located in `.github/workflows/release-apk.yml`. Pushing a version tag (e.g., `git tag v1.0.0 && git push --tags`) or manually triggering the workflow compiles a release APK using EAS Build and uploads it to GitHub Releases automatically.
- **OTA Updates:** Deploy JavaScript changes over-the-air instantly:
  ```bash
  eas update --branch production
  ```
