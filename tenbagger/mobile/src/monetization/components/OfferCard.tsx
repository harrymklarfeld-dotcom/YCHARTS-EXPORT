/**
 * Affiliate offer card (disabled unless FLAGS.affiliateEnabled). Articles only.
 * Always shows a "Sponsored" label and the disclosure. Never used in the Money hub.
 */
import { useEffect } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { OfferPlacement } from '../../config/monetization';
import { useTheme } from '../../theme';
import { offersFor } from '../affiliate';
import { track } from '../analytics';
import { useEntitlement } from '../hooks';

export function OfferCard({ placement, articleTags, articleId }: { placement: OfferPlacement; articleTags?: string[]; articleId?: string }) {
  const t = useTheme();
  const { tier } = useEntitlement();
  const offers = offersFor(placement, { tier, articleTags });
  const offer = offers[0];
  useEffect(() => {
    if (offer) track('offer_impression', { offer: offer.id, placement, article: articleId });
  }, [offer, placement, articleId]);
  if (!offer) return null;
  return (
    <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.c.line, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ backgroundColor: t.c.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text accessibilityLabel="Sponsored" style={{ color: t.c.ink, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>SPONSORED</Text>
        </View>
        <Text style={{ color: t.c.inkSoft, fontSize: 11 }}>{offer.partner}</Text>
      </View>
      <Text style={{ color: t.c.ink, fontFamily: t.fonts.display, fontSize: 18, fontWeight: '700' }}>{offer.headline}</Text>
      <Text style={{ color: t.c.inkSoft, fontSize: 14, lineHeight: 20 }}>{offer.body}</Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${offer.cta}, sponsored link to ${offer.partner}`}
        onPress={() => {
          track('offer_click', { offer: offer.id, placement, article: articleId });
          void Linking.openURL(offer.url);
        }}
      >
        <Text style={{ color: t.c.primary, fontWeight: '800', fontSize: 15 }}>{offer.cta} ›</Text>
      </Pressable>
      <Text style={{ color: t.c.inkSoft, fontSize: 11, lineHeight: 16 }}>{offer.disclosure}</Text>
    </View>
  );
}
