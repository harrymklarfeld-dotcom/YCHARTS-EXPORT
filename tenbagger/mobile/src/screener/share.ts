/**
 * Share/copy CSV text. Native: the system share sheet. Web: download a .csv file and copy to
 * the clipboard (whichever the browser allows).
 */
import { Platform, Share } from 'react-native';

export type ShareOutcome = 'shared' | 'downloaded' | 'copied' | 'dismissed' | 'failed';

export async function shareCsv(csv: string, filename: string): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    const g = globalThis as unknown as {
      document?: { createElement(t: string): { href: string; download: string; click(): void; remove?(): void }; body?: { appendChild(n: unknown): void } };
      URL?: { createObjectURL(b: unknown): string; revokeObjectURL(u: string): void };
      Blob?: new (parts: string[], opts: { type: string }) => unknown;
      navigator?: { clipboard?: { writeText(s: string): Promise<void> } };
    };
    let outcome: ShareOutcome = 'failed';
    try {
      if (g.document && g.URL && g.Blob) {
        const url = g.URL.createObjectURL(new g.Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const a = g.document.createElement('a');
        a.href = url;
        a.download = filename;
        g.document.body?.appendChild(a);
        a.click();
        a.remove?.();
        setTimeout(() => g.URL?.revokeObjectURL(url), 1000);
        outcome = 'downloaded';
      }
    } catch {
      /* fall through to clipboard */
    }
    try {
      await g.navigator?.clipboard?.writeText(csv);
      if (outcome === 'failed') outcome = 'copied';
    } catch {
      /* clipboard may be blocked */
    }
    return outcome;
  }
  try {
    const r = await Share.share({ title: filename, message: csv });
    return r.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}
