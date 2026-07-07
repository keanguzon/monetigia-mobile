import useSWR from 'swr';
import { getSupabase } from '../../lib/supabase';

export function useAccounts(userId: string | undefined) {
  return useSWR(userId ? `accounts-${userId}` : null, async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("accounts")
      .select("id, name, balance, type")
      .eq("user_id", userId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
      
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
