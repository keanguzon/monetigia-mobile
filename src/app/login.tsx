import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { getSupabase } from "../../lib/supabase";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as QueryParams from "expo-auth-session/build/QueryParams";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const sessionSetRef = useRef(false);

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
    <View className="flex-1 items-center justify-center bg-slate-950 p-6">
      <View className="w-full max-w-sm p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <View className="mb-8">
          <Text className="text-3xl font-bold text-center text-white mb-2">Monetigia</Text>
          <Text className="text-slate-400 text-center">Continue with OAuth to access your dashboard</Text>
        </View>

        {errorMsg ? (
          <View className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-6">
            <Text className="text-red-400 text-sm text-center">{errorMsg}</Text>
          </View>
        ) : null}

        <View className="flex flex-col gap-3">
          <TouchableOpacity
            onPress={() => handleOAuthLogin("google")}
            disabled={isLoading}
            className="w-full bg-white flex flex-row items-center justify-center py-3 px-4 rounded-lg active:bg-slate-200"
          >
            <Text className="text-slate-900 font-medium text-base">Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleOAuthLogin("facebook")}
            disabled={isLoading}
            className="w-full bg-[#1877F2] flex flex-row items-center justify-center py-3 px-4 rounded-lg active:bg-[#1877F2]/80"
          >
            <Text className="text-white font-medium text-base">Continue with Facebook</Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
          <View className="mt-6 flex flex-row justify-center">
            <ActivityIndicator size="small" color="#10b981" />
          </View>
        )}
      </View>
    </View>
  );
}
