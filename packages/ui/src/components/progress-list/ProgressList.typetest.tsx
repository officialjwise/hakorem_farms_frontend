import { ProgressList } from './ProgressList';

// @ts-expect-error The list must have a name.
export const blank = <ProgressList label="" items={[]} />;
