import { Donut } from './Donut';

// @ts-expect-error A donut must have a title.
export const blank = <Donut title="" segments={[]} />;
