import { render, screen } from '@testing-library/react';
import { Avatar, initialsOf } from './Avatar';

describe('initialsOf', () => {
  it.each([
    ['Ama Mensah', 'AM'],
    ['Kofi', 'K'],
    ['  Ama   Serwaa   Mensah  ', 'AM'],
    ['ama mensah', 'am'],
    ['', ''],
    ['   ', ''],
  ])('%j gives %j', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe('Avatar', () => {
  it('is named by the person, and shows initials when there is no photo', () => {
    render(<Avatar name="Ama Mensah" />);
    expect(screen.getByRole('img', { name: 'Ama Mensah' })).toHaveTextContent('AM');
  });

  it('shows initials while an image has not loaded', () => {
    render(<Avatar name="Kofi Boateng" src="/never-loads.jpg" />);
    expect(screen.getByRole('img', { name: 'Kofi Boateng' })).toHaveTextContent('KB');
  });

  it('throws on a blank name', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Avatar name=" " />)).toThrow(/name/);
    quiet.mockRestore();
  });
});
