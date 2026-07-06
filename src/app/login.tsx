import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { getSupabase } from "../../lib/supabase";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { AuroraBackground } from "../components/ui/AuroraBackground";
import { GlassCard } from "../components/ui/GlassCard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../theme/ThemeProvider";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const sessionSetRef = useRef(false);
  const { colors } = useTheme();

  useEffect(() => {
    AsyncStorage.getItem("KEEP_SIGNED_IN").then(val => {
      if (val !== null) {
        setKeepSignedIn(val === "true");
      }
    });
  }, []);

  const toggleKeepSignedIn = async () => {
    const newValue = !keepSignedIn;
    setKeepSignedIn(newValue);
    await AsyncStorage.setItem("KEEP_SIGNED_IN", String(newValue));
  };

  const redirectTo = makeRedirectUri({
    scheme: "monetigia",
    path: "login"
  });

  const handleTokens = async (url: string) => {
    if (sessionSetRef.current) return;
    
    try {
      const { params, errorCode } = QueryParams.getQueryParams(url);
      if (errorCode) throw new Error(errorCode);
      
      const { access_token, refresh_token } = params;
      if (access_token && refresh_token) {
        sessionSetRef.current = true;
        await getSupabase().auth.setSession({ access_token, refresh_token });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse auth token");
    }
  };

  useEffect(() => {
    const subscription = Linking.addEventListener("url", (e) => handleTokens(e.url));
    return () => subscription.remove();
  }, []);

  const handleOAuthLogin = async (provider: "google" | "facebook") => {
    sessionSetRef.current = false;
    setIsLoading(true);
    setErrorMsg("");

    try {
      const { data, error } = await getSupabase().auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error) throw error;
      
      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type === "success" && res.url) {
          await handleTokens(res.url);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <GlassCard style={{ width: "100%", maxWidth: 384 }}>
          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontFamily: "BricolageGrotesque_700Bold", fontSize: 36, color: colors.text, textAlign: "center", marginBottom: 8 }}>
              Monetigia
            </Text>
            <Text style={{ fontFamily: "Manrope_400Regular", fontSize: 16, color: colors.textMuted, textAlign: "center" }}>
              Continue with OAuth to access your dashboard
            </Text>
          </View>

          {errorMsg ? (
            <View style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.2)", borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 24 }}>
              <Text style={{ fontFamily: "Manrope_500Medium", color: "#ef4444", fontSize: 14, textAlign: "center" }}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <TouchableOpacity
              onPress={() => handleOAuthLogin("google")}
              disabled={isLoading}
              style={{ width: "100%", backgroundColor: "#ffffff", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontFamily: "Manrope_500Medium", color: "#0f172a", fontSize: 16 }}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleOAuthLogin("facebook")}
              disabled={isLoading}
              style={{ width: "100%", backgroundColor: "#1877F2", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontFamily: "Manrope_500Medium", color: "#ffffff", fontSize: 16 }}>Continue with Facebook</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={toggleKeepSignedIn} 
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 24 }}
          >
            <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: keepSignedIn ? colors.primary : colors.textMuted, backgroundColor: keepSignedIn ? colors.primary : "transparent", marginRight: 10, alignItems: "center", justifyContent: "center" }}>
              {keepSignedIn && <View style={{ width: 10, height: 10, backgroundColor: "#fff", borderRadius: 2 }} />}
            </View>
            <Text style={{ fontFamily: "Manrope_500Medium", fontSize: 14, color: colors.text }}>
              Keep me signed in
            </Text>
          </TouchableOpacity>

          {isLoading && (
            <View style={{ marginTop: 24, flexDirection: "row", justifyContent: "center" }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </GlassCard>
      </View>
    </View>
  );
}
