# Tenbagger content: the articles library

Short, interactive explainers that sit next to the lessons. Every article is one Markdown file
in `articles/`. `build.mjs` turns them into `../data/articles.json`, which the mobile app and the
website both read. It has no npm dependencies and needs Node 18 or newer.

```bash
node content/build.mjs           # validate + write data/articles.json
node content/build.mjs --check   # validate only
cd content && npm test           # parser + validation tests (node:test)
```

## How to add an article in 2 minutes

1. `cp content/articles/_template.md content/articles/my-topic.md`. The file name is the slug.
2. Fill in the frontmatter. `unit` and `relatedLessons` must be ids from `data/lessons.json`
   (for example `u4-cashflow` and `u4-l2`). `metrics` are keys from `widgets.json → metrics`.
3. Write 600–1,100 words of plain English. Use `##`/`###` headings, lists, **bold** and *italic*.
   Tables, images, raw HTML and `#` H1 are not allowed.
4. Drop in at least two widgets. The full list is in [WIDGETS.md](WIDGETS.md). The ones you'll use most:

   ````
   ```widget:metric ticker=MU metric=free_cash_flow
   ```
   ```widget:compare tickers=MU,COST,MSFT metric=roic
   ```
   ```widget:history ticker=MU metric=free_cash_flow average=true
   ```
   ```widget:calculator kind=dcf ticker=MU
   ```
   ```widget:quiz lesson=u4-l2
   ```
   ````

5. Run `node content/build.mjs`. If it prints an error, it names the file and line and says what to fix:
   an unknown ticker, a metric the company has no value for, a lesson id that doesn't exist, or wording
   that sounds like advice.
6. Run `cd content && npm test` (it checks that `data/articles.json` is up to date), then hand it to the lead.

## Rules of the house

- **Educational, never advice.** No buy/sell/hold, no price targets, no "undervalued". The build rejects these
  phrases with the same list the lesson generator uses.
- **Numbers come from widgets.** A number you type in the prose must be Micron's real reported figure,
  or clearly illustrative ("imagine a shop that…"). Every company except MU is currently **sample data**.
  Widgets tag it automatically, and the prose should say so when it leans on a sample number.
- **Rewards follow learning.** Reading an article earns no XP. The `widget:quiz` card opens the lesson,
  and finishing the lesson is what earns XP.

## Files

| Path | What |
|---|---|
| `articles/*.md` | The articles. Files starting with `_` are ignored |
| `articles/_template.md` | Start here |
| `WIDGETS.md` | Widget spec, output shape, and the rendering and math rules both apps follow |
| `widgets.json` | Machine-readable spec: widget params, metric catalog, provenance and voice rules |
| `build.mjs`, `lib/` | Parser (`lib/parse.mjs`) and validator (`lib/validate.mjs`) |
| `tests/` | `node:test` suites |
