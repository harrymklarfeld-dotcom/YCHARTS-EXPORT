/**
 * <screener-app> — client-side screener over companies.json using the shared
 * @tenbagger/screener engine (presets, typed queries, explanations).
 */
import {
  PRESET_SCREENS,
  runScreen,
  safeParseQuery,
  getMetricInfo,
  explainMatch,
  describeCondition,
  type Company,
  type Filter,
  type Screen,
} from '../../../packages/screener/src/index.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Filters → a query string the parser reads back identically ("ROIC > 15% and P/E < 25x"). */
const toQuery = (fs: readonly Filter[]) => fs.map((f) => `${(getMetricInfo(f.metric)?.shortLabel ?? f.metric).replace(/\./g, '')} ${describeCondition(f)}`).join(' and ');
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9-]/g, '-');

class ScreenerApp extends HTMLElement {
  companies: Company[] = [];
  mini = false;
  current: Screen | null = null;
  sector = '';

  connectedCallback() {
    try {
      this.companies = JSON.parse(this.querySelector('script[type="application/json"]')?.textContent ?? '[]');
    } catch {
      this.companies = [];
    }
    this.mini = this.hasAttribute('mini');
    this.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) =>
      b.addEventListener('click', () => {
        const p = PRESET_SCREENS.find((x) => x.id === b.dataset.preset);
        if (!p) return;
        this.select(b);
        const q = this.querySelector<HTMLInputElement>('[data-query]');
        if (q) q.value = toQuery(p.filters);
        this.run(p);
      }),
    );
    const form = this.querySelector<HTMLFormElement>('[data-query-form]');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.runQuery();
    });
    this.querySelector<HTMLSelectElement>('[data-sector]')?.addEventListener('change', (e) => {
      this.sector = (e.target as HTMLSelectElement).value;
      if (this.current) this.run(this.current);
    });
    // Deep link: /screener/?preset=cash-machines or ?q=pe<20
    const params = new URLSearchParams(location.search);
    const pre = params.get('preset');
    const q = params.get('q');
    if (q && !this.mini) {
      const input = this.querySelector<HTMLInputElement>('[data-query]');
      if (input) input.value = q;
      this.runQuery();
    } else if (pre) {
      this.querySelector<HTMLButtonElement>(`[data-preset="${CSS.escape(pre)}"]`)?.click();
    } else {
      const first = this.querySelector<HTMLButtonElement>('[data-preset][aria-pressed="true"]') ?? this.querySelector<HTMLButtonElement>('[data-preset]');
      first?.click();
    }
  }

  select(b: HTMLButtonElement | null) {
    this.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }

  runQuery() {
    const input = this.querySelector<HTMLInputElement>('[data-query]');
    const msg = this.querySelector<HTMLElement>('[data-query-msg]');
    const text = input?.value.trim() ?? '';
    if (!text) return;
    const r = safeParseQuery(text);
    if (msg) {
      msg.innerHTML = [...r.errors.map((e) => `<span class="sc-err">${esc(e.message)}</span>`), ...r.warnings.map((w) => `<span>${esc(w.message)}</span>`)].join(' ');
    }
    if (!r.ok || r.filters.length === 0) return;
    this.select(null);
    const first = r.filters[0];
    const info = getMetricInfo(first.metric);
    const dir = info?.higherIsBetter === false ? 'asc' : 'desc';
    this.run({ id: 'custom', name: 'Your screen', description: `Companies where ${toQuery(r.filters)}.`, filters: r.filters, sort: { metric: first.metric, dir } });
  }

  run(screen: Screen) {
    this.current = screen;
    const pool = this.sector ? this.companies.filter((c) => c.sector === this.sector) : this.companies;
    let out;
    try {
      out = runScreen(pool, screen);
    } catch (e) {
      const res = this.querySelector('[data-results]');
      if (res) res.innerHTML = `<p class="sc-err">${esc((e as Error).message)}</p>`;
      return;
    }
    const keys: string[] = [];
    for (const f of screen.filters) if (!keys.includes(f.metric)) keys.push(f.metric);
    if (screen.sort && !keys.includes(screen.sort.metric)) keys.push(screen.sort.metric);
    const preset = PRESET_SCREENS.find((p) => p.id === screen.id);
    const desc = this.querySelector('[data-desc]');
    if (desc) {
      desc.innerHTML = `<p><strong>${esc(screen.name)}.</strong> ${esc(screen.description)}</p>${preset?.caveat ? `<p class="small muted"><strong>What it can miss:</strong> ${esc(preset.caveat)}</p>` : ''}`;
    }
    const rows = (this.mini ? out.results.slice(0, 5) : out.results)
      .map((r) => {
        const c = r.company;
        const why = explainMatch(c, screen).join(' · ');
        return `<tr><td><a href="/companies/${slug(c.ticker)}/"><span class="ticker">${esc(c.ticker)}</span> ${esc(c.name)}</a>${this.mini ? '' : `<div class="sc-why small muted">${esc(why)}</div>`}</td>${
          this.mini ? '' : `<td class="sc-sector">${esc(c.sector)}</td>`
        }${keys.map((k) => `<td class="n">${esc(getMetricInfo(k)?.format(r.values[k as keyof typeof r.values] ?? null) ?? '—')}</td>`).join('')}</tr>`;
      })
      .join('');
    const head = `<tr><th scope="col">Company</th>${this.mini ? '' : '<th scope="col">Sector</th>'}${keys.map((k) => `<th scope="col" class="n" title="${esc(getMetricInfo(k)?.label ?? k)}">${esc(getMetricInfo(k)?.shortLabel ?? k)}</th>`).join('')}</tr>`;
    const res = this.querySelector('[data-results]');
    if (!res) return;
    const count = `<p class="sc-count small"><strong>${out.results.length}</strong> of ${pool.length} companies match${
      out.excludedForMissingData ? ` · ${out.excludedForMissingData} left out for missing data` : ''
    }${this.mini && out.results.length > 5 ? ` · showing top 5` : ''}</p>`;
    res.innerHTML =
      count +
      (out.results.length
        ? `<div class="table-wrap"><table class="data"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`
        : `<p class="muted sc-none">No companies pass every filter. Try loosening one — that’s part of the lesson.</p>`);
  }
}

if (!customElements.get('screener-app')) customElements.define('screener-app', ScreenerApp);
