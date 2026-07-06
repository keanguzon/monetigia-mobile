import { Redirect } from "expo-router";
import { useSession } from "./_layout";

export default function Index() {
  const { session } = useSession();
  return <Redirect href={session ? "/(tabs)" : "/login"} />;
}
