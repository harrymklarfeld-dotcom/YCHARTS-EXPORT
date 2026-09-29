/**
 * Short, plain-English explainers opened from the Money dashboard (/money/learn/<topic>).
 * Educational only: they describe how things work and never suggest a product or a trade.
 */
export type LearnTopic = {
  id: string;
  title: string;
  eyebrow: string;
  paragraphs: string[];
  /** Related lesson ids in data/lessons.json. */
  lessons: string[];
};

export const LEARN_TOPICS: Record<string, LearnTopic> = {
  diversification: {
    id: 'diversification',
    title: 'Diversification',
    eyebrow: 'Learn · Investing basics',
    paragraphs: [
      'Diversification means spreading money across many companies, industries and kinds of assets, so one bad outcome has a smaller effect on the whole.',
      'An index fund such as an S&P 500 fund already owns hundreds of companies. A single stock is one company: its results can swing far more than the market as a whole.',
      'Owning several things does not always mean being diversified. Two funds can own many of the same companies, and a few large technology stocks can make up a big share of a broad index fund. That is what the X-ray view looks through.',
      'Weight matters more than count. Ten holdings where one is 60% of the money behave mostly like that one holding.',
      'Diversification lowers the risk that comes from any one company. It does not remove the risk of the whole market falling.',
    ],
    lessons: ['u5-l1', 'u7-l2'],
  },
  utilization: {
    id: 'utilization',
    title: 'Credit utilization',
    eyebrow: 'Learn · Credit',
    paragraphs: [
      'Utilization is the card balance divided by the credit limit. A $450 balance on a $1,500 limit is 30%.',
      'Credit scoring models look at utilization because a card close to its limit can signal strain. Lower usually reads better.',
      '"Under 30%" and "under 10%" are rules of thumb, not hard cut-offs. People with the highest scores tend to use a small share of their limits.',
      'The balance that counts is usually the one on the statement, so paying down before the statement date lowers the reported number.',
      'Utilization has no memory in most models: it reflects the latest reported balances, unlike late payments, which stay on a report for years.',
    ],
    lessons: ['u5-l4'],
  },
  'statement-vs-due': {
    id: 'statement-vs-due',
    title: 'Statement date vs due date',
    eyebrow: 'Learn · Credit',
    paragraphs: [
      'The statement date is when the billing cycle closes. Everything charged up to then becomes the statement balance.',
      'The due date comes later (in the US at least 21 days after the statement is sent). That gap is the grace period.',
      'Paying the full statement balance by the due date means no interest on those purchases. Paying only the minimum avoids a late fee, but interest starts on the rest, and new purchases can lose the grace period too.',
      'Charges made after the statement date land on the next statement, so the current balance and the statement balance are often different numbers.',
    ],
    lessons: ['u5-l4'],
  },
  'emergency-fund': {
    id: 'emergency-fund',
    title: 'Emergency fund',
    eyebrow: 'Learn · Saving',
    paragraphs: [
      'An emergency fund is cash set aside for surprises: a car repair, a lost shift, a medical bill.',
      'It is measured in weeks or months of spending, because that is what it has to cover. The dashboard uses your recent average daily spending.',
      'Companies do the same thing with their cash buffer. The current ratio compares cash and short-term assets with the bills due soon.',
    ],
    lessons: ['u5-l4', 'u5-l2'],
  },
  'income-volatility': {
    id: 'income-volatility',
    title: 'Income volatility',
    eyebrow: 'Learn · Income',
    paragraphs: [
      'Hourly and per-session pay moves around: fewer shifts during exams, more in summer, a paycheck that is late because hours were not submitted.',
      'The coefficient of variation (standard deviation ÷ average) puts that swing on one scale. 0.10 means months are usually within about 10% of the average; 0.50 means they swing by about half.',
      'Analysts look at the same thing in companies: steady revenue is easier to plan around than lumpy revenue, even at the same average.',
    ],
    lessons: ['u1-l2'],
  },
  'personal-10k': {
    id: 'personal-10k',
    title: 'The Personal 10-K',
    eyebrow: 'Learn · Reading your own numbers',
    paragraphs: [
      'A 10-K is the annual report a public company files. It has an income statement (what came in and went out), a balance sheet (what it owns and owes) and a cash-flow statement.',
      'Your monthly version works the same way: income − spending is your free cash flow; cash + investments − debts is your net worth (your "equity").',
      'When spending beats income, the gap has to come from somewhere: cash on hand, or new debt such as a card balance. The cash-flow summary shows which.',
    ],
    lessons: ['u4-l2', 'u5-l1', 'u5-l3', 'u5-l4'],
  },
};

export function getLearnTopic(id: string): LearnTopic | undefined {
  return LEARN_TOPICS[id];
}
