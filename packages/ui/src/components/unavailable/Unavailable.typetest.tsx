import { Unavailable } from './Unavailable';

// @ts-expect-error An unavailable figure must say so in words.
export const blank = <Unavailable title="" />;
