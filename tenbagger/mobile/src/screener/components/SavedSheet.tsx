import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { Eyebrow } from '../../components/ui';
import { useTheme } from '../../theme';
import type { SavedScreen, Watchlist } from '../lists';
import { useScreenerPrefs } from '../store';

/** Save the current screen / results, and reopen saved screens and watchlists. All on-device. */
export function SavedSheet({
  visible,
  onClose,
  canSaveScreen,
  resultTickers,
  onSaveScreen,
  onOpenScreen,
  onOpenWatchlist,
}: {
  visible: boolean;
  onClose: () => void;
  canSaveScreen: boolean;
  resultTickers: string[];
  onSaveScreen: (name: string) => void;
  onOpenScreen: (s: SavedScreen) => void;
  onOpenWatchlist: (w: Watchlist) => void;
}) {
  const t = useTheme();
  const saved = useScreenerPrefs((s) => s.savedScreens);
  const lists = useScreenerPrefs((s) => s.watchlists);
  const deleteScreen = useScreenerPrefs((s) => s.deleteScreen);
  const createWatchlist = useScreenerPrefs((s) => s.createWatchlist);
  const deleteWatchlist = useScreenerPrefs((s) => s.deleteWatchlist);
  const [name, setName] = useState('');

  const input = (
    <TextInput
      accessibilityLabel="Name"
      value={name}
      onChangeText={setName}
      placeholder="Name (optional)"
      placeholderTextColor={t.c.locked}
      maxLength={40}
      style={{ borderWidth: 1.5, borderColor: t.c.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: t.c.ink, fontSize: 15 }}
    />
  );
  const btn = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: disabled ? t.c.locked : t.c.primary }}
    >
      <Text style={{ color: t.c.primaryInk, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Saved">
      <View style={{ gap: 18 }}>
        <View style={{ gap: 8 }}>
          <Eyebrow>Save on this device</Eyebrow>
          {input}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {btn('Save screen', () => {
              onSaveScreen(name);
              setName('');
            }, !canSaveScreen)}
            {btn(`Save ${resultTickers.length} results as watchlist`, () => {
              createWatchlist(name, resultTickers);
              setName('');
            }, resultTickers.length === 0)}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Eyebrow>Screens ({saved.length})</Eyebrow>
          {saved.length === 0 ? <Text style={{ color: t.c.inkSoft }}>No saved screens yet.</Text> : null}
          {saved.map((s) => (
            <Row key={s.id} title={s.name} subtitle={`${s.filters.length} filter${s.filters.length === 1 ? '' : 's'} · ${s.columns.length} columns`} onOpen={() => onOpenScreen(s)} onDelete={() => deleteScreen(s.id)} />
          ))}
        </View>

        <View style={{ gap: 6 }}>
          <Eyebrow>Watchlists ({lists.length})</Eyebrow>
          {lists.length === 0 ? <Text style={{ color: t.c.inkSoft }}>No watchlists yet.</Text> : null}
          {lists.map((w) => (
            <Row key={w.id} title={w.name} subtitle={w.tickers.join(', ') || 'empty'} onOpen={() => onOpenWatchlist(w)} onDelete={() => deleteWatchlist(w.id)} />
          ))}
        </View>
      </View>
    </Sheet>
  );
}

function Row({ title, subtitle, onOpen, onDelete }: { title: string; subtitle: string; onOpen: () => void; onDelete: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.c.line }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={onOpen} style={{ flex: 1 }}>
        <Text style={{ color: t.c.ink, fontWeight: '800' }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: t.c.inkSoft, fontSize: 12 }}>{subtitle}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${title}`} onPress={onDelete} hitSlop={8}>
        <Icon name="trash" color={t.c.danger} size={18} />
      </Pressable>
    </View>
  );
}
