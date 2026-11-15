import { StatTile, type StatTrend } from './StatTile';

// @ts-expect-error A figure must say what it is.
export const blank = <StatTile label="" value="1" />;
// @ts-expect-error The trend's tone is good, critical or neutral, never a colour.
export const colour: StatTrend = { direction: 'up', tone: 'green', label: 'up' };
