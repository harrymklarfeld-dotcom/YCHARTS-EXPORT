/** <money-demo> island: re-renders the coverage check as sliders move. */
import { formatUSD } from '../../../packages/money/src/index.ts';
import { renderCoverage } from '../lib/coverage-render.ts';

class MoneyDemo extends HTMLElement {
  connectedCallback() {
    const out = this.querySelector<HTMLElement>('[data-out]')!;
    const get = () => {
      const v = (n: string) => Number(this.querySelector<HTMLInputElement>(`[name="${n}"]`)?.value ?? 0);
      return {
        cash: v('cash'),
        statement: v('statement'),
        dailySpend: v('dailySpend'),
        countPending: this.querySelector<HTMLInputElement>('[name="countPending"]')?.checked ?? true,
      };
    };
    const update = () => {
      const inp = get();
      this.querySelectorAll<HTMLOutputElement>('output[data-for]').forEach((o) => {
        const key = o.dataset.for as keyof typeof inp;
        o.textContent = key === 'dailySpend' ? `${formatUSD(inp.dailySpend)}/day` : formatUSD(Number(inp[key]));
      });
      out.innerHTML = renderCoverage(inp);
    };
    this.querySelectorAll('input').forEach((i) => i.addEventListener('input', update));
    update();
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('money-demo')) customElements.define('money-demo', MoneyDemo);
