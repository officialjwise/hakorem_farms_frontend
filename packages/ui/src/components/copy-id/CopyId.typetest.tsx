import { CopyId } from './CopyId';

// @ts-expect-error a blank value is refused at compile time
<CopyId value="" copyLabel="Copy" copiedLabel="Copied" failedLabel="Could not copy" />;
// @ts-expect-error a blank button name is refused at compile time
<CopyId value="EGG-0003" copyLabel="" copiedLabel="Copied" failedLabel="Could not copy" />;
// @ts-expect-error the button needs a name
<CopyId value="EGG-0003" copiedLabel="Copied" failedLabel="Could not copy" />;
<CopyId
  value="EGG-0003"
  copyLabel="Copy EGG-0003"
  copiedLabel="Copied"
  failedLabel="Could not copy"
/>;
