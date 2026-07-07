# Mobile Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate SWR for client-side caching in the mobile app to improve performance without changing business logic.

**Architecture:** The mobile app currently fetches data via direct Supabase REST calls inside `useEffect`. We will wrap these calls in `SWR` hooks to provide instant caching and optimistic UI updates, mirroring the web implementation.

**Tech Stack:** React Native, Expo, SWR, Supabase

## Global Constraints
- Do not modify existing Supabase backend schema or RPC logic.
- Keep the user interface design untouched.
- Maintain existing directory structures.

---

### Task 1: Install SWR in Mobile

**Files:**
- Modify: `f:/Projects/monetigia-codebase/monetigia-mobile/package.json`

**Interfaces:**
- Consumes: None
- Produces: SWR dependency available to the app

- [ ] **Step 1: Install SWR dependency**

```bash
cd f:/Projects/monetigia-codebase/monetigia-mobile
npm install swr
```

### Task 2: Create Custom SWR Hooks for Data Fetching

**Files:**
- Create: `f:/Projects/monetigia-codebase/monetigia-mobile/src/hooks/useData.ts`

**Interfaces:**
- Consumes: Supabase auth user
- Produces: `useAccounts()` and `useCategories()` custom hooks

- [ ] **Step 1: Write SWR hooks**

```typescript
import useSWR from 'swr';
import { getSupabase } from '../lib/supabase';

export function useAccounts(userId: string | undefined) {
  return useSWR(userId ? `accounts-${userId}` : null, async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("accounts")
      .select("id, name, balance, type")
      .eq("user_id", userId)
      .order("name");
      
    if (error) throw error;
    return data || [];
  });
}

export function useCategories(userId: string | undefined) {
  return useSWR(userId ? `categories-${userId}` : null, async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, type")
      .eq("user_id", userId)
      .order("name");
      
    if (error) throw error;
    return data || [];
  });
}
```

### Task 3: Refactor AddTransactionModal to use SWR

**Files:**
- Modify: `f:/Projects/monetigia-codebase/monetigia-mobile/src/components/transactions/AddTransactionModal.tsx`

**Interfaces:**
- Consumes: `useAccounts`, `useCategories` from `src/hooks/useData.ts`
- Produces: Snappy modal with cached data.

- [ ] **Step 1: Add SWR hook imports and replace state variables**

```typescript
import { useAccounts, useCategories } from '../../hooks/useData';

// Inside AddTransactionModal component, replace `useState` for accounts/categories with:
const { data: accounts = [], mutate: mutateAccounts } = useAccounts(user?.id);
const { data: categories = [], mutate: mutateCategories } = useCategories(user?.id);
```

- [ ] **Step 2: Remove old loadDependencies effect**

```typescript
// Replace the old useEffect and loadDependencies function with a new simplified effect:
useEffect(() => {
  if (!visible || accounts.length === 0) return;
  
  const creditAccounts = accounts.filter(a => a.type === 'credit_card');
  const nonCreditAccounts = accounts.filter(a => a.type !== 'credit_card');
  const preferredAcc = initialAccountId ? accounts.find(a => a.id === initialAccountId) : null;

  if (preferredAcc && preferredAcc.type === 'credit_card') {
    setType('transfer');
    setTransferToAccountId(preferredAcc.id);
    const defaultSource = nonCreditAccounts.length > 0 ? nonCreditAccounts[0].id : (accounts.find(a => a.id !== preferredAcc.id)?.id || null);
    setSelectedAccountId(defaultSource);
  } else if (!selectedAccountId) {
    const defaultId = initialAccountId && accounts.some(a => a.id === initialAccountId)
      ? initialAccountId
      : nonCreditAccounts.length > 0 ? nonCreditAccounts[0].id : accounts[0].id;
    setSelectedAccountId(defaultId);
  }
}, [visible, accounts, initialAccountId]);
```
