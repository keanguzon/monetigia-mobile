// @ts-ignore
import "../../global.css";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { getSupabase } from "../../lib/supabase";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";
import { Session, User } from "@supabase/supabase-js";
import { View, ActivityIndicator, Text, Animated, TouchableOpacity, Platform, LogBox } from "react-native";
import { useFonts } from "expo-font";
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque";
import { Manrope_400Regular, Manrope_500Medium } from "@expo-google-fonts/manrope";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Updates from "expo-updates";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

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
  const [updatesChecked, setUpdatesChecked] = useState(false);
  const [updateStep, setUpdateStep] = useState<'checking' | 'downloading' | 'up-to-date'>('checking');
  const [updateError, setUpdateError] = useState<string | null>(null);
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      try {
        const supabase = getSupabase();
        
        // Check "Keep me signed in" preference (Option B)
        const keepSignedIn = await AsyncStorage.getItem("KEEP_SIGNED_IN");
        if (keepSignedIn === "false") {
          try {
            await supabase.auth.signOut();
          } catch (e) {
            // ignore network errors on signout
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setInitialized(true);

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
    };
    
    initAuth();

    return () => subscription?.unsubscribe();
  }, []);

  const checkUpdates = async () => {
    try {
      if (__DEV__) {
        setUpdatesChecked(true);
        return;
      }
      setUpdateError(null);
      setUpdateStep('checking');
      
      const update = await Promise.race([
        Updates.checkForUpdateAsync(),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error("Update check timed out. Please check your connection.")), 6000)
        )
      ]);
      
      if (update.isAvailable) {
        setUpdateStep('downloading');
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } else {
        setUpdateStep('up-to-date');
        setTimeout(() => setUpdatesChecked(true), 1200);
      }
    } catch (e: any) {
      console.warn("Update check failed:", e);
      setUpdateError(e.message || String(e));
    }
  };

  useEffect(() => {
    checkUpdates();
  }, []);

  const handleSkipUpdate = () => {
    setUpdatesChecked(true);
  };

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(tabs)";

    if ((!session || initError) && segments[0] !== "login") {
      router.replace("/login");
    } else if (session && !initError && !inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, initialized, segments, initError]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <BottomSheetModalProvider>
          <LayoutContent 
            initialized={initialized && updatesChecked && (fontsLoaded || !!fontError)} 
            initError={initError || (fontError ? "Failed to load fonts" : null)} 
            session={session} 
            updateStep={updateStep}
            updateError={updateError}
            onRetryUpdate={checkUpdates}
            onSkipUpdate={handleSkipUpdate}
          />
        </BottomSheetModalProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function LayoutContent({ 
  initialized, 
  initError, 
  session, 
  updateStep,
  updateError,
  onRetryUpdate,
  onSkipUpdate
}: { 
  initialized: boolean; 
  initError: string | null; 
  session: Session | null; 
  updateStep: 'checking' | 'downloading' | 'up-to-date';
  updateError: string | null;
  onRetryUpdate: () => void;
  onSkipUpdate: () => void;
}) {
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!initialized) {
      if (updateStep === 'checking') {
        Animated.timing(progress, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: false,
        }).start();
      } else if (updateStep === 'downloading') {
        Animated.timing(progress, {
          toValue: 0.8,
          duration: 3000,
          useNativeDriver: false,
        }).start();
      } else if (updateStep === 'up-to-date') {
        Animated.timing(progress, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }).start();
      }
    }
  }, [updateStep, initialized]);

  const widthInterpolate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const getStatusText = () => {
    switch (updateStep) {
      case 'checking':
        return 'Checking for updates...';
      case 'downloading':
        return 'Installing updates...';
      case 'up-to-date':
        return 'App is up to date!';
      default:
        return 'Loading...';
    }
  };

  if (!initialized) {
    return (
      <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: colors.background }}>
        <View className="items-center w-full max-w-sm">
          <Text 
            style={{ 
              color: colors.text, 
              fontFamily: 'BricolageGrotesque_700Bold', 
              fontSize: 40,
              letterSpacing: Platform.select({ ios: -1, android: 0 }),
              marginBottom: 24,
              textAlign: 'center',
              alignSelf: 'stretch',
            }}
          >
            Monetigia
          </Text>
          
          {!updateError ? (
            <>
              <View style={{ width: 180, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
                <Animated.View style={{ width: widthInterpolate, height: '100%', backgroundColor: colors.primary }} />
              </View>

              <Text style={{ color: colors.textMuted, fontFamily: 'Manrope_500Medium', fontSize: 13, alignSelf: 'stretch', width: '100%', letterSpacing: Platform.select({ ios: 0, android: 0 }) }} className="text-center">
                {getStatusText()}
              </Text>
            </>
          ) : (
            <View style={{ width: '100%', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', padding: 16, marginTop: 8, alignItems: 'center' }}>
              <Text style={{ color: '#ef4444', fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, marginBottom: 4 }}>Update Check Failed</Text>
              <Text style={{ color: colors.textMuted, fontFamily: 'Manrope_400Regular', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>{updateError}</Text>
              
              <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', width: '100%' }}>
                <TouchableOpacity 
                  onPress={onRetryUpdate}
                  style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                >
                  <Text style={{ color: '#fff', fontFamily: 'Manrope_500Medium', fontSize: 13 }}>Retry</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={onSkipUpdate}
                  style={{ borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                >
                  <Text style={{ color: colors.text, fontFamily: 'Manrope_500Medium', fontSize: 13 }}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (initError) {
    return (
      <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: colors.background }}>
        <Text className="text-red-400 text-center font-medium text-lg mb-2">Unable to connect</Text>
        <Text className="text-center text-sm" style={{ color: colors.textMuted }}>Please check your network and update the app.</Text>
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
