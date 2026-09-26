import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Title } from './ui';

/** Bottom sheet built on Modal (works on iOS, Android and web). */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close sheet" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(8,12,20,0.45)' }} />
      <View
        style={{
          backgroundColor: t.c.surface,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          padding: 20,
          paddingBottom: 20 + insets.bottom,
          maxHeight: '80%',
          borderTopWidth: 1,
          borderColor: t.c.line,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Title size={22} style={{ flex: 1 }}>{title}</Title>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
            <Icon name="close" color={t.c.inkSoft} />
          </Pressable>
        </View>
        <ScrollView>{children}</ScrollView>
      </View>
    </Modal>
  );
}
