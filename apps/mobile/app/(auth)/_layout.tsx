import { Stack } from 'expo-router';

/** Signed-out screens: enter email, then enter the code. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />;
}
