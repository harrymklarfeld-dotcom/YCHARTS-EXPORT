import Tabs from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { MoneyIcon } from '../../money/components';
import { useTheme } from '../../theme';

const tab = (title: string, icon: IconName, a11y: string) => ({
  title,
  tabBarAccessibilityLabel: a11y,
  tabBarIcon: ({ color }: { color: ColorValue }) => <Icon name={icon} color={String(color)} size={24} />,
});

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.c.primary,
        tabBarInactiveTintColor: t.c.inkSoft,
        tabBarStyle: { backgroundColor: t.c.surface, borderTopColor: t.c.line, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        sceneStyle: { backgroundColor: t.c.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Learn', 'path', 'Learn tab: lesson path')} />
      <Tabs.Screen name="screener" options={tab('Screener', 'filter', 'Screener tab')} />
      <Tabs.Screen name="companies" options={tab('Companies', 'building', 'Companies tab')} />
      <Tabs.Screen
        name="money"
        options={{
          title: 'Money',
          tabBarAccessibilityLabel: 'Money tab: your money hub',
          tabBarIcon: ({ color }: { color: ColorValue }) => <MoneyIcon color={String(color)} size={24} />,
        }}
      />
      <Tabs.Screen name="profile" options={tab('Profile', 'user', 'Profile tab')} />
    </Tabs>
  );
}
