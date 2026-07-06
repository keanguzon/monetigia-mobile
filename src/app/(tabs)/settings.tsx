import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Switch, Alert, TextInput, DeviceEventEmitter } from "react-native";
import { getSupabase } from "../../../lib/supabase";
import { useSession } from "../_layout";
import { useTheme } from "../../theme/ThemeProvider";
import { GlassCard } from "../../components/ui/GlassCard";
import { User, LogOut, Save, ShieldCheck, RefreshCw } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { EVENTS } from "../../lib/events";
import { Image } from "expo-image";
import * as Updates from "expo-updates";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { user } = useSession();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const loadData = async () => {
    try {
      if (!user) return;

      // Fetch Auth Providers
      const appProviders = user.app_metadata?.providers;
      const provider = user.app_metadata?.provider;
      const parsedProviders = Array.isArray(appProviders)
        ? appProviders
        : provider
          ? [provider]
          : [];
      setProviders(parsedProviders.map((item) => String(item)));

      // Fetch Profile Data
      const { data: userData, error } = await getSupabase()
        .from("users")
        .select("name, avatar_url")
        .eq("id", user.id)
        .single();

      if (userData) {
        setName(userData.name || "");
        setAvatarUrl(userData.avatar_url || null);
      }

      // Fetch Preferences
      const storedKeepSignedIn = await AsyncStorage.getItem("KEEP_SIGNED_IN");
      if (storedKeepSignedIn !== null) {
        setKeepSignedIn(storedKeepSignedIn === "true");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSaveProfile = async () => {
    if (!user || isSavingProfile) return;
    setIsSavingProfile(true);

    try {
      const { error } = await getSupabase()
        .from("users")
        .update({ name: name.trim() })
        .eq("id", user.id);

      if (error) throw error;
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      DeviceEventEmitter.emit(EVENTS.USER_UPDATED);
      Alert.alert("Success", "Profile updated successfully.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update profile.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const toggleKeepSignedIn = async (value: boolean) => {
    setKeepSignedIn(value);
    await AsyncStorage.setItem("KEEP_SIGNED_IN", String(value));
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setIsSigningOut(true);
            try {
              // Attempt standard network sign-out
              const { error } = await getSupabase().auth.signOut();
              if (error) throw error;
            } catch (err) {
              // Adversarial Trap Fix: Network drop or flaky connection.
              // Forcefully obliterate local session to prevent being trapped on borrowed devices.
              console.warn("Network signout failed, executing local purge", err);
              await getSupabase().auth.signOut({ scope: 'local' });
            } finally {
              // Always push to login regardless of network state
              router.replace("/login");
              setIsSigningOut(false);
            }
          }
        }
      ]
    );
  };

  const getInitials = (fullName: string) => {
    if (!fullName) return "?";
    return fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const handleCheckForUpdates = async () => {
    try {
      setIsCheckingUpdate(true);
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        Alert.alert(
          "Update Available",
          "Downloading the latest version...",
          [{ text: "OK" }]
        );
        await Updates.fetchUpdateAsync();
        Alert.alert(
          "Update Ready",
          "The app will now restart to apply the update.",
          [{ text: "Restart", onPress: () => Updates.reloadAsync() }]
        );
      } else {
        Alert.alert("Up to date", "You are already on the latest version.");
      }
    } catch (error: any) {
      Alert.alert("Error", "Failed to check for updates: " + error.message);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: colors.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={{ padding: 24, paddingTop: 64 }}>
        <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, color: colors.text, marginBottom: 4 }}>Settings</Text>
        <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted, marginBottom: 24 }}>Manage your profile and preferences</Text>

        {/* Profile Card */}
        <GlassCard style={{ marginBottom: 16, padding: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            {avatarUrl ? (
              <Image 
                source={{ uri: avatarUrl }} 
                style={{ width: 64, height: 64, borderRadius: 32, marginRight: 16 }} 
                contentFit="cover"
              />
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(34, 197, 94, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24, color: colors.primary }}>
                  {getInitials(name)}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, color: colors.text }}>{name || "User"}</Text>
              <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 14, color: colors.textMuted }}>{user?.email}</Text>
            </View>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, marginBottom: 16 }}>
            <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.textMuted, marginBottom: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Display Name</Text>
            <TextInput
              style={{ fontFamily: 'Manrope_500Medium', color: colors.text, fontSize: 16, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 }}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <TouchableOpacity 
            style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            onPress={handleSaveProfile}
            disabled={isSavingProfile}
          >
            {isSavingProfile ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save color="#fff" size={16} style={{ marginRight: 8 }} />
                <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#fff', fontSize: 16 }}>Save Profile</Text>
              </>
            )}
          </TouchableOpacity>
        </GlassCard>

        {/* Authentication Card */}
        <GlassCard style={{ marginBottom: 16, padding: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <ShieldCheck color={colors.text} size={20} style={{ marginRight: 8 }} />
            <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18, color: colors.text }}>Authentication</Text>
          </View>
          
          <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted, fontSize: 14, marginBottom: 12 }}>
            You are signed in via OAuth.
          </Text>
          
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {providers.length > 0 ? providers.map(p => (
              <View key={p} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 }}>
                <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.text, fontSize: 12, textTransform: 'uppercase' }}>{p}</Text>
              </View>
            )) : (
              <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted, fontSize: 12 }}>No providers found.</Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
            <Text style={{ fontFamily: 'Manrope_500Medium', color: colors.text, fontSize: 16 }}>Keep me signed in</Text>
            <Switch 
              value={keepSignedIn} 
              onValueChange={toggleKeepSignedIn} 
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </GlassCard>

        {/* App Updates Card */}
        <GlassCard style={{ marginBottom: 16, padding: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <RefreshCw color={colors.text} size={20} style={{ marginRight: 8 }} />
            <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18, color: colors.text }}>App Updates</Text>
          </View>
          
          <Text style={{ fontFamily: 'Manrope_400Regular', color: colors.textMuted, fontSize: 14, marginBottom: 16 }}>
            Check if there's a new Over-The-Air (OTA) update available for download.
          </Text>
          
          <TouchableOpacity 
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            onPress={handleCheckForUpdates}
            disabled={isCheckingUpdate}
          >
            {isCheckingUpdate ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: colors.text, fontSize: 16 }}>Check for Updates</Text>
            )}
          </TouchableOpacity>
        </GlassCard>

        {/* Danger Zone */}
        <View style={{ marginTop: 24, marginBottom: 40 }}>
          <TouchableOpacity 
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            onPress={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <ActivityIndicator color="#ef4444" />
            ) : (
              <>
                <LogOut color="#ef4444" size={20} style={{ marginRight: 8 }} />
                <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', color: '#ef4444', fontSize: 16 }}>Sign Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}
