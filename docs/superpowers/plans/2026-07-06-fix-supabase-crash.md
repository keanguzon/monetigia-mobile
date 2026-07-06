# Supabase Crash Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the app from hard-crashing when Supabase environment variables are missing (such as during an EAS cloud build without secrets).

**Architecture:** Update `lib/supabase.ts` to provide fallback dummy strings when `EXPO_PUBLIC_SUPABASE_URL` is undefined. This stops `@supabase/supabase-js` from throwing a fatal initialization error on app launch.

**Tech Stack:** React Native, Supabase JS

---

### Task 1: Handle Missing Environment Variables

**Files:**
- Modify: `lib/supabase.ts:1-11` and `lib/supabase.ts:59-71`

- [ ] **Step 1: Write the failing test**
*(Skipped as there is no testing framework configured in this Expo project yet, prioritizing the hotfix).*

- [ ] **Step 2: Write minimal implementation**

```typescript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import 'react-native-get-random-values';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';

const { supabaseUrl, supabaseAnonKey } = Constants.expoConfig?.extra || {};

// Prevent hard crashes if environment variables are missing
const safeSupabaseUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeSupabaseAnonKey = supabaseAnonKey || 'placeholder-anon-key';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL or Anon Key is missing. App will not function correctly.');
}

class LargeSecureStore {
  // ... existing implementation remains unchanged ...
```

```typescript
export const supabase = createClient(
  safeSupabaseUrl,
  safeSupabaseAnonKey,
  {
    auth: {
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.ts
git commit -m "fix: gracefully handle missing supabase environment variables to prevent crash"
```
