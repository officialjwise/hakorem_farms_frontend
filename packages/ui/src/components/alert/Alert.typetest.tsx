import { Alert } from './Alert';

// @ts-expect-error A blank title would leave severity to colour alone.
export const blank = <Alert severity="info" title="" />;
// @ts-expect-error Severity is one of four, not a free colour.
export const colour = <Alert severity="teal" title="Saved" />;
