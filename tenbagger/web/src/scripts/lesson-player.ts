/**
 * <lesson-player> — plays lesson questions in the browser (vanilla custom element).
 * Data comes from a <script type="application/json"> child. Supports all five
 * question types from data/lessons.json.
 */
type Q = {
  id: string;
  type: 'multiple_choice' | 'numeric' | 'true_false' | 'compare' | 'order';
  prompt: string;
  choices?: string[];
  answer: number | boolean | number[];
  tolerance?: number;
  unit?: string;
  explanation: string;
  source?: { ticker?: string; fy?: number };
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** "12.5%", "$12.3B", "4.2x", "1,200" → number in the question's unit. */
export function parseAnswer(text: string, unit?: string): number | null {
  const t = text.trim().toLowerCase().replace(/[,\s$]/g, '').replace(/[x×%]$/, '');
  const m = t.match(/^(-?\d*\.?\d+)(k|m|b|bn|t)?$/);
  if (!m) return null;
  let v = parseFloat(m[1]);
  const mult: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, bn: 1e9, t: 1e12 };
  if (m[2]) v *= mult[m[2]];
  if (unit === 'percent') v /= 100;
  return Number.isFinite(v) ? v : null;
}

function fmtAnswer(v: number, unit?: string): string {
  if (unit === 'percent') return `${(v * 100).toFixed(1)}%`;
  if (unit === 'multiple') return `${v.toFixed(2)}x`;
  if (unit === 'usd') {
    const a = Math.abs(v);
    const tiers: Array<[number, string]> = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M']];
    for (const [s, k] of tiers) if (a >= s) return `${v < 0 ? '-' : ''}$${(a / s).toFixed(1)}${k}`;
    return `$${v.toFixed(2)}`;
  }
  return String(v);
}

class LessonPlayer extends HTMLElement {
  qs: Q[] = [];
  i = 0;
  correct = 0;
  order: number[] = [];
  answered = false;
  selected: number | boolean | null = null;
  stage!: HTMLElement;
  bar!: HTMLElement;
  count!: HTMLElement;

  connectedCallback() {
    const data = this.querySelector('script[type="application/json"]');
    try {
      this.qs = JSON.parse(data?.textContent ?? '[]');
    } catch {
      this.qs = [];
    }
    this.stage = this.querySelector('[data-stage]')!;
    this.bar = this.querySelector('[data-bar]')!;
    this.count = this.querySelector('[data-count]')!;
    this.querySelector('[data-start]')?.addEventListener('click', () => this.render());
    if (!this.querySelector('[data-start]')) this.render();
  }

  progress() {
    const pct = (this.i / Math.max(1, this.qs.length)) * 100;
    this.bar.style.width = `${pct}%`;
    this.count.textContent = this.i < this.qs.length ? `${this.i + 1} / ${this.qs.length}` : `${this.qs.length} / ${this.qs.length}`;
  }

  render() {
    this.answered = false;
    this.selected = null;
    this.order = [];
    this.progress();
    if (this.i >= this.qs.length) return this.finish();
    const q = this.qs[this.i];
    const src = q.source?.ticker ? `<span class="lp-src">${esc(q.source.ticker)} · FY${q.source.fy ?? ''} 10-K</span>` : '';
    let body = '';
    if (q.type === 'multiple_choice' || q.type === 'compare') {
      body = `<div class="lp-choices ${q.type === 'compare' ? 'lp-compare' : ''}" role="group" aria-label="Answer choices">${(q.choices ?? [])
        .map((c, k) => `<button type="button" class="lp-choice" data-k="${k}"><span class="lp-key">${String.fromCharCode(65 + k)}</span><span>${esc(c)}</span></button>`)
        .join('')}</div>`;
    } else if (q.type === 'true_false') {
      body = `<div class="lp-choices lp-compare" role="group" aria-label="True or false"><button type="button" class="lp-choice" data-tf="true"><span class="lp-key">T</span><span>True</span></button><button type="button" class="lp-choice" data-tf="false"><span class="lp-key">F</span><span>False</span></button></div>`;
    } else if (q.type === 'numeric') {
      const hint = q.unit === 'percent' ? '%' : q.unit === 'multiple' ? 'x' : q.unit === 'usd' ? '$' : '';
      body = `<label class="lp-num"><span class="sr-only">Your answer</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="${q.unit === 'usd' ? 'e.g. 12.3B' : 'Your answer'}" data-num /><span class="lp-unit">${hint}</span></label>`;
    } else if (q.type === 'order') {
      body = `<p class="small muted lp-order-help">Tap the items in order, first to last.</p><div class="lp-choices" data-order>${(q.choices ?? [])
        .map((c, k) => `<button type="button" class="lp-choice" data-o="${k}"><span class="lp-key" data-pos></span><span>${esc(c)}</span></button>`)
        .join('')}</div>`;
    }
    this.stage.innerHTML = `
      <div class="lp-q">
        ${src}
        <p class="lp-prompt">${esc(q.prompt)}</p>
        ${body}
      </div>
      <div class="lp-foot" data-foot>
        <div class="lp-feedback" data-feedback aria-live="polite"></div>
        <button type="button" class="btn btn-primary lp-check" data-check disabled>Check</button>
      </div>`;
    const check = this.stage.querySelector<HTMLButtonElement>('[data-check]')!;
    this.stage.querySelectorAll<HTMLButtonElement>('.lp-choice').forEach((b) =>
      b.addEventListener('click', () => {
        if (this.answered) return;
        if (q.type === 'order') {
          const k = Number(b.dataset.o);
          const at = this.order.indexOf(k);
          if (at >= 0) this.order.splice(at, 1);
          else this.order.push(k);
          this.stage.querySelectorAll<HTMLButtonElement>('[data-o]').forEach((x) => {
            const p = this.order.indexOf(Number(x.dataset.o));
            x.classList.toggle('is-picked', p >= 0);
            x.querySelector('[data-pos]')!.textContent = p >= 0 ? String(p + 1) : '';
          });
          check.disabled = this.order.length !== (q.choices?.length ?? 0);
          return;
        }
        this.stage.querySelectorAll('.lp-choice').forEach((x) => x.classList.remove('is-picked'));
        b.classList.add('is-picked');
        this.selected = b.dataset.tf ? b.dataset.tf === 'true' : Number(b.dataset.k);
        check.disabled = false;
      }),
    );
    const num = this.stage.querySelector<HTMLInputElement>('[data-num]');
    num?.addEventListener('input', () => (check.disabled = parseAnswer(num.value, q.unit) === null));
    num?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !check.disabled) check.click();
    });
    check.addEventListener('click', () => (this.answered ? this.next() : this.grade(q, check, num)));
    (this.stage.querySelector('.lp-choice, [data-num]') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  grade(q: Q, check: HTMLButtonElement, num: HTMLInputElement | null) {
    let ok = false;
    let right = '';
    if (q.type === 'multiple_choice' || q.type === 'compare') {
      ok = this.selected === q.answer;
      right = q.choices?.[q.answer as number] ?? '';
      this.stage.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => {
        if (Number(b.dataset.k) === q.answer) b.classList.add('is-right');
        else if (b.classList.contains('is-picked')) b.classList.add('is-wrong');
      });
    } else if (q.type === 'true_false') {
      ok = this.selected === q.answer;
      right = q.answer ? 'True' : 'False';
      this.stage.querySelectorAll<HTMLElement>('[data-tf]').forEach((b) => {
        if ((b.dataset.tf === 'true') === q.answer) b.classList.add('is-right');
        else if (b.classList.contains('is-picked')) b.classList.add('is-wrong');
      });
    } else if (q.type === 'numeric') {
      const v = parseAnswer(num?.value ?? '', q.unit);
      const tol = q.tolerance ?? Math.abs(Number(q.answer)) * 0.02;
      ok = v !== null && Math.abs(v - Number(q.answer)) <= tol + 1e-12;
      right = fmtAnswer(Number(q.answer), q.unit);
      num?.setAttribute('readonly', '');
      num?.classList.add(ok ? 'is-right' : 'is-wrong');
    } else if (q.type === 'order') {
      const ans = q.answer as number[];
      ok = ans.every((k, j) => this.order[j] === k);
      right = ans.map((k) => q.choices?.[k]).join(' → ');
      this.stage.querySelectorAll<HTMLElement>('[data-o]').forEach((b) => b.classList.add(ok ? 'is-right' : 'is-wrong'));
    }
    if (ok) this.correct++;
    this.answered = true;
    this.stage.querySelector('[data-foot]')!.classList.add(ok ? 'is-ok' : 'is-no');
    this.stage.querySelector('[data-feedback]')!.innerHTML = `
      <p class="lp-verdict">${ok ? 'Correct.' : `Not quite. Answer: <strong>${esc(right)}</strong>`}</p>
      <p class="lp-expl">${esc(q.explanation)}</p>`;
    check.textContent = this.i + 1 < this.qs.length ? 'Continue' : 'See result';
    check.focus({ preventScroll: true });
  }

  next() {
    this.i++;
    this.render();
  }

  finish() {
    const total = this.qs.length;
    const cta = this.dataset.ctaHref ? `<a class="btn btn-primary" href="${esc(this.dataset.ctaHref)}">${esc(this.dataset.ctaLabel ?? 'Keep going')}</a>` : '';
    this.stage.innerHTML = `
      <div class="lp-done">
        <p class="lp-score"><span class="big-number">${this.correct}/${total}</span></p>
        <p class="lp-done-title">${this.correct === total ? 'Clean sweep.' : this.correct > 0 ? 'Nice work.' : 'Everyone starts somewhere.'} +${this.correct * 10} XP</p>
        <p class="muted">That was one real lesson, built from real 10-K numbers. The app has ${esc(this.dataset.totalLessons ?? 'dozens of')} more, three minutes each.</p>
        <div class="btn-row">${cta}<button type="button" class="btn" data-again>Play again</button></div>
      </div>`;
    this.stage.querySelector('[data-again]')?.addEventListener('click', () => {
      this.i = 0;
      this.correct = 0;
      this.render();
    });
  }
}

if (!customElements.get('lesson-player')) customElements.define('lesson-player', LessonPlayer);
