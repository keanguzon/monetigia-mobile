import { Tabs } from "expo-router";
import { Home, Wallet, ArrowLeftRight } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#020617", // slate-950
          borderTopColor: "#1e293b", // slate-800
        },
        tabBarActiveTintColor: "#10b981", // emerald-500
        tabBarInactiveTintColor: "#64748b", // slate-500
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
    </Tabs>
  );
}
