import { PackageX } from 'lucide-react';
import { AlertRow } from './AlertRow';

// @ts-expect-error A row must say what it is.
export const blank = <AlertRow icon={PackageX} title="" />;
// @ts-expect-error The icon is required: every row says what kind of record it is.
export const noIcon = <AlertRow title="Goat meat" />;
