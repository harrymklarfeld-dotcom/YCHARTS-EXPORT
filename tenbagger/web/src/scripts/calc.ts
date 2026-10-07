/** <calc-widget> island: sliders → renderCalc(). */
import { renderCalc, type CalcState } from '../lib/calc-render.ts';
import { wfmt } from '../lib/wformat.ts';

class CalcWidget extends HTMLElement {
  connectedCallback() {
    let state: CalcState;
    try {
      state = JSON.parse(this.querySelector('script[type="application/json"]')?.textContent ?? '{}');
    } catch {
      return;
    }
    const panel = this.querySelector<HTMLElement>('[data-out]')!;
    const update = () => {
      this.querySelectorAll<HTMLInputElement>('input[data-key]').forEach((inp) => {
        const key = inp.dataset.key!;
        const v = inp.type === 'checkbox' ? inp.checked : Number(inp.value);
        (state as Record<string, unknown>)[key] = v;
        const o = this.querySelector<HTMLOutputElement>(`output[data-for="${key}"]`);
        if (o && typeof v === 'number') o.textContent = wfmt(inp.dataset.format ?? 'ratio', v);
      });
      const fcfRow = this.querySelector<HTMLElement>('[data-fcf-row]');
      if (fcfRow && state.kind === 'dcf') fcfRow.toggleAttribute('data-disabled', state.useNormalized);
      panel.innerHTML = renderCalc(state);
    };
    this.querySelectorAll('input[data-key]').forEach((i) => i.addEventListener('input', update));
    update();
  }
}

if (!customElements.get('calc-widget')) customElements.define('calc-widget', CalcWidget);
