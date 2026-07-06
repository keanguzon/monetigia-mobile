import { Tabs } from "expo-router";
import { Home, Wallet, ArrowLeftRight, User } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { View } from "react-native";
import { useState } from "react";
import { FAB } from "../../components/ui/FAB";
import { AddTransactionModal } from "../../components/transactions/AddTransactionModal";

export default function TabLayout() {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, size }) => <ArrowLeftRight color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Accounts",
          tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
      
      <FAB onPress={() => setModalVisible(true)} />
      <AddTransactionModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
      />
    </View>
  );
}
