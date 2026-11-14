/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Tabs, TabsList, TabsTrigger } from './Tabs';

export const valid = [
  <Tabs key="1" defaultValue="a">
    <TabsList aria-label="Animal record">
      <TabsTrigger value="a">Details</TabsTrigger>
    </TabsList>
  </Tabs>,
];

export const invalid = [
  // An unnamed tab list.
  <Tabs key="a" defaultValue="a">
    {/* @ts-expect-error aria-label or aria-labelledby is required */}
    <TabsList>
      <TabsTrigger value="a">Details</TabsTrigger>
    </TabsList>
  </Tabs>,
];
