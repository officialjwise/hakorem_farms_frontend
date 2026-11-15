/**
 * Compile-time tests: `pnpm typecheck` fails if any line marked
 * @ts-expect-error stops being an error, meaning the API got looser.
 */
import { Field } from '../field/Field';
import { PhotoInput } from './PhotoInput';

const LABELS = {
  chooseLabel: 'Take or choose a photo',
  replaceLabel: 'Take another',
  removeLabel: 'Remove the photo',
  busyLabel: 'Sending the photo',
  previewAlt: 'The photograph you took',
} as const;
const upload = async () => 'file-id';
const noop = () => undefined;

export const valid = [
  <Field key="1" label="Photograph">
    <PhotoInput {...LABELS} value={null} onChange={noop} upload={upload} />
  </Field>,
];

export const invalid = [
  // Every state has words.
  // @ts-expect-error a blank busy label is refused
  <PhotoInput key="a" {...LABELS} busyLabel="" value={null} onChange={noop} upload={upload} />,

  // The upload is the app's: the component never calls the API.
  // @ts-expect-error upload is required
  <PhotoInput key="b" {...LABELS} value={null} onChange={noop} />,
];
