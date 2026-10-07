import type { Dashboard, DashTab, LocalMoneyState } from '../dashboard';
import type { MoneyHub } from '../hub';

export type TabProps = {
  dash: Dashboard;
  hub: MoneyHub;
  local: LocalMoneyState;
  wide: boolean;
  goTab: (tab: DashTab) => void;
};
