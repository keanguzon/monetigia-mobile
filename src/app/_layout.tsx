import "../../global.css";
import { createContext, useContext, useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { getSupabase } from "../../lib/supabase";
import { Session, User } from "@supabase/supabase-js";
import { View, ActivityIndicator, Text } from "react-native";

type SessionContextType = {
  session: Session | null;
  user: User | null;
};

const SessionContext = createContext<SessionContextType>({
  session: null,
  user: null,
});

export function useSession() {
  return useContext(SessionContext);
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    try {
      const supabase = getSupabase();

      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          setSession(session);
          setInitialized(true);
        })
        .catch((err) => {
          setSession(null);
          setInitialized(true);
        });

      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          setSession(session);
        }
      );
      subscription = sub;
    } catch (err: any) {
      console.error("Supabase init failed:", err.message);
      setInitError(err.message);
      setInitialized(true);
    }

    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(tabs)";

    if ((!session || initError) && inAuthGroup) {
      router.replace("/login");
    } else if (session && !initError && !inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, initialized, segments, initError]);

  if (!initialized) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (initError) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950 p-6">
        <Text className="text-red-400 text-center font-medium text-lg mb-2">Unable to connect</Text>
        <Text className="text-slate-400 text-center text-sm">Please check your network and update the app.</Text>
      </View>
    );
  }

  return (
    <SessionContext.Provider value={{ session, user: session?.user ?? null }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
      </Stack>
    </SessionContext.Provider>
  );
}
