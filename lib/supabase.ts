import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import 'react-native-get-random-values';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';

class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = Crypto.getRandomBytes(256 / 8);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    const encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);

    // Write data first to avoid key corruption.
    await AsyncStorage.setItem(key, encryptedHex);
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return encryptedHex;
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return encryptionKeyHex;

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    try {
      const encrypted = await AsyncStorage.getItem(key);
      if (!encrypted) return encrypted;
      return await this._decrypt(key, encrypted);
    } catch (e) {
      // Clear corrupt data
      await this.removeItem(key).catch(() => {});
      return null;
    }
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string) {
    try {
      await this._encrypt(key, value);
    } catch (e) {
      console.error('LargeSecureStore.setItem failed:', e);
      throw e;
    }
  }
}

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const url = Constants.expoConfig?.extra?.supabaseUrl;
  const key = Constants.expoConfig?.extra?.supabaseAnonKey;

  if (!url || !key) {
    throw new Error('Supabase config missing. Ensure EXPO_PUBLIC_SUPABASE_URL is set.');
  }

  _supabase = createClient(url, key, {
    auth: {
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return _supabase;
}
