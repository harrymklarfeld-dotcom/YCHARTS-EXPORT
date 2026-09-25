# Tenbagger lesson engine

Turns `data/companies.json` into `data/lessons.json`: Duolingo-style lessons that teach
fundamental analysis with **real reported numbers**. Every numeric answer is computed
deterministically from companies.json. No LLM-generated numbers, and no advice
(see `lessons/safety.py`). The curriculum is in [CURRICULUM.md](CURRICULUM.md).

```bash
cd tenbagger/lessons
python -m lessons build --companies ../data/companies.json --out ../data/lessons.json --seed 42
python -m pytest -q                       # offline; runs on tests/fixtures + data/companies.json if present
python tests/fixtures/make_fixture.py     # regenerate the 8-company test fixture
```

Python 3.11, stdlib only (pytest for tests). Flags: `--no-portfolio` omits the
personalizable unit, and `-v` lists template slots that were skipped.

## How it works

| File | Role |
|---|---|
| `lessons/formulas.py` | **Metric registry.** Each metric computes its value from a company (or returns `None` when inputs are missing or meaningless), shows the arithmetic with real numbers (`$35.3B ÷ $275.2B = 12.8%`), lists *common-mistake* distractors, and gives a plain-English gloss. Formulas follow CONTRACT.md exactly. |
| `lessons/curriculum.py` | **Curriculum as data.** Units, then lessons (intro card + ordered slots). A slot is `(kind, metric[, "max"])`, where kind is `mc`, `num`, `tf`, `cmp` or `ord`. |
| `lessons/questions.py` | Builders for `multiple_choice`, `numeric`, `true_false`, `compare` and `order`, plus the **ambiguity guards**. |
| `lessons/generator.py` | Fills slots. Each lesson gets its own `random.Random(f"{seed}:{lesson_id}")`, so output is byte-identical for the same seed and input, regardless of company order. It prefers companies not yet used in the lesson and keeps up to 8 questions. |
| `lessons/portfolio.py` | The personalizable "Your portfolio" unit (see below). |
| `lessons/safety.py` | Banned-phrase scanner (buy/sell/hold, price target, undervalued, "you should", …). The build **fails** if any prose matches. |

### Guards
* **Skipped inputs.** A template is skipped if any input is null, or negative where the
  ratio would be meaningless: P/E with EPS ≤ 0, tax rate with pre-tax income ≤ 0, cash
  conversion with a loss, EPS growth from or to a loss, D/E with equity ≤ 0, DCF with FCF ≤ 0.
* **MC distractors.** Distractors come from real mistakes first (net income instead of
  gross profit, capex added instead of subtracted, dividing the wrong way round). Each
  must differ from the answer by at least 15% (percent: at least 1.5 points), and from
  the other distractors, and must display differently. If there aren't 3 such
  distractors, the question is dropped.
* **Compare and order.** Adjacent values must differ by at least 15% (2 points for
  percents).
* **True/false thresholds.** Thresholds are round numbers at least 10% away from the
  value, with the same sign, and never 0.
* **Bad numbers.** Non-finite numbers abort the build. Company order doesn't affect the
  output.

## Output (CONTRACT.md `lessons.json`, plus additive fields)
The contract shape is unchanged. Extra fields the app can ignore:
* top level: `generated_from` (companies source, generated_at, tickers, seed) and `disclaimer`.
* `source`: `inputs` (raw values used), `params` (assumptions such as the discount rate),
  `threshold` (true/false), and `tickers`, `fys`, `direction` or `values` (compare/order).
* `order` questions put the items to rank in `choices`. `answer` lists indices into
  `choices`, from highest to lowest.
* Percent answers are decimals (`0.128`), and `tolerance` is absolute on the decimal:
  0.005, or 0.001 for values under 5%. USD answers are raw dollars with a 2% tolerance.

### Personalizable lessons (`personalizable: true`, unit `u9-portfolio`)
Prompts and explanations contain `{holding.<name>}` placeholders. Each question has a
`personalization` block with these fields:
* `placeholders` maps each placeholder to `{expr, format}`. For example,
  `holding.gross_margin` maps to `metrics.gross_margin` with format `percent`.
* `answer_rule`: `"expr"` means the app recomputes the answer from `answer_expr`, which
  uses `fundamentals.x`, `metrics.x`, `price`, `+ - * /` and `< >`. `"fixed"` is a
  conceptual multiple-choice question whose answer never changes.
* `requires_positive`: expressions that must be greater than 0 for the user's holding.
  If one isn't, or any placeholder is null, the app skips the question.
* `example`: the prompt and explanation rendered for a real example company. The shipped
  `answer` is for that company.

`lessons.portfolio.evaluate()` and `render()` are the reference implementation of this
protocol.

## Tests (`tests/`)
* `test_schema`: validates the contract shape, 5-8 questions per lesson, and 60-120-word intros.
* `test_determinism`: same seed gives the same output, a different seed changes it, and
  company order doesn't matter.
* `test_recompute`: recomputes every answer from companies.json with **independent**
  formulas, covering numeric values, the correct multiple-choice choice, true/false
  thresholds, compare winners and order rankings.
* `test_contract_metrics`: our math agrees with the pipeline's `metrics` block.
* `test_distractors`: choices are unique, gaps are meaningful, and true/false thresholds aren't razor-thin.
* `test_banned`: scans all output text and templates for advice language.
* `test_portfolio`: placeholders resolve and answers match `answer_expr`.
* `test_guards`: handles nulls and loss makers (no P/E for negative EPS).
