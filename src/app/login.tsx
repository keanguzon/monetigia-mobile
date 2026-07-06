import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import Svg, { Path } from "react-native-svg";
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

const GoogleIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

const FacebookIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="#1877F2">
    <Path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </Svg>
);

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const sessionSetRef = useRef(false);
  const { colors } = useTheme();

  useEffect(() => {
    try {
      AsyncStorage.getItem("KEEP_SIGNED_IN").then(val => {
        if (val !== null) {
          setKeepSignedIn(val === "true");
        }
      }).catch(() => {
        setKeepSignedIn(true);
      });
    } catch (e) {
      setKeepSignedIn(true);
    }
  }, []);

  const toggleKeepSignedIn = async () => {
    const newValue = !keepSignedIn;
    setKeepSignedIn(newValue);
    try {
      await AsyncStorage.setItem("KEEP_SIGNED_IN", String(newValue));
    } catch (e) {
      // Ignore storage errors on low-end devices
    }
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
        <GlassCard style={{ width: "100%", maxWidth: 384, paddingVertical: 48, paddingHorizontal: 24 }}>
          <View style={{ marginBottom: 40, alignItems: "center" }}>
            <Image 
              source={require("../../assets/images/logos/main-logo.png")} 
              style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 20 }} 
              resizeMode="contain" 
            />
            <Text style={{ fontFamily: "Manrope_500Medium", fontSize: 16, color: colors.textMuted, textAlign: "center" }}>
              Continue with OAuth to access your dashboard
            </Text>
          </View>

          {errorMsg ? (
            <View style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.2)", borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 24 }}>
              <Text style={{ fontFamily: "Manrope_500Medium", color: "#ef4444", fontSize: 14, textAlign: "center" }}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={{ display: "flex", flexDirection: "column", gap: 12, width: "90%", alignSelf: "center" }}>
            <TouchableOpacity
              onPress={() => handleOAuthLogin("google")}
              disabled={isLoading}
              style={{ 
                width: "100%", 
                backgroundColor: "#ffffff", 
                paddingVertical: 14, 
                paddingHorizontal: 16, 
                borderRadius: 12, 
                alignItems: "center", 
                justifyContent: "center",
                flexDirection: "row",
                gap: 10
              }}
            >
              <GoogleIcon />
              <Text style={{ fontFamily: "Manrope_500Medium", color: "#0f172a", fontSize: 16 }}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleOAuthLogin("facebook")}
              disabled={isLoading}
              style={{ 
                width: "100%", 
                backgroundColor: "transparent", 
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 14, 
                paddingHorizontal: 16, 
                borderRadius: 12, 
                alignItems: "center", 
                justifyContent: "center",
                flexDirection: "row",
                gap: 10
              }}
            >
              <FacebookIcon />
              <Text style={{ fontFamily: "Manrope_500Medium", color: colors.text, fontSize: 16 }}>Continue with Facebook</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={toggleKeepSignedIn} 
            disabled={isLoading}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 24, opacity: isLoading ? 0.5 : 1 }}
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
