import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CodeInput } from './code-input';

/** Harness mirroring how EntryScreen owns the value. */
function Harness({
  onComplete = () => {},
  error = false,
}: {
  onComplete?: (code: string) => void;
  error?: boolean;
}) {
  const [value, setValue] = useState('');
  return <CodeInput value={value} onChange={setValue} onComplete={onComplete} error={error} />;
}

const input = () => screen.getByLabelText('code-input') as HTMLInputElement;

describe('CodeInput (14.2 AC2 — the flagship component)', () => {
  it('renders six segment boxes', () => {
    render(<Harness />);
    expect(screen.getAllByTestId('code-box')).toHaveLength(6);
  });

  it('typing fills boxes left to right (auto-advance is inherent)', async () => {
    render(<Harness />);
    await userEvent.type(input(), '123');
    const boxes = screen.getAllByTestId('code-box');
    expect(boxes.map((b) => b.textContent)).toEqual(['1', '2', '3', '', '', '']);
  });

  it('uses a numeric keyboard and one-time-code autocomplete', () => {
    render(<Harness />);
    expect(input().getAttribute('inputmode')).toBe('numeric');
    expect(input().getAttribute('autocomplete')).toBe('one-time-code');
  });

  it('filters non-digits', async () => {
    render(<Harness />);
    await userEvent.type(input(), '1a2b3c');
    expect(input().value).toBe('123');
  });

  it('paste fills and auto-submits on the 6th digit — exactly once', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.change(input(), { target: { value: '123456' } });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('paste with separators is cleaned ("12-34 56" → 123456)', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.change(input(), { target: { value: '12-34 56' } });
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('caps input at six digits', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '12345678' } });
    expect(input().value).toBe('123456');
  });

  it('backspace walks back through boxes', async () => {
    render(<Harness />);
    await userEvent.type(input(), '1234');
    await userEvent.type(input(), '{Backspace}');
    expect(input().value).toBe('123');
  });

  it('stays LTR even inside an RTL document (14.3 AC4)', () => {
    render(
      <div dir="rtl">
        <Harness />
      </div>,
    );
    expect(screen.getByTestId('code-boxes').getAttribute('dir')).toBe('ltr');
  });

  it('error state shakes the boxes and marks the input invalid', () => {
    render(<Harness error />);
    expect(screen.getByTestId('code-boxes').className).toContain('animate-shake');
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });
});
