import { PageHeader } from './PageHeader';

// @ts-expect-error A page must have a title.
export const blank = <PageHeader title="" />;
