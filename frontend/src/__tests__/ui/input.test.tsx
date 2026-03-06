import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/input'; // Adjust import path as necessary
import { expect } from 'vitest';
import React from 'react';

describe('Input Component', () => {
  it('renders correctly with default props', () => {
    render(<Input />);
    const inputElement = screen.getByRole('textbox');
    expect(inputElement).toBeInTheDocument();
    expect(inputElement).toHaveClass('flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50');
  });

  it('applies the correct type attribute', () => {
    render(<Input type="email" />);
    const inputElement = screen.getByRole('textbox'); // email type still renders as textbox role
    expect(inputElement).toHaveAttribute('type', 'email');
  });

  it('displays the placeholder text', () => {
    render(<Input placeholder="Enter your name" />);
    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
  });

  it('displays the correct value', () => {
    render(<Input value="Test Value" readOnly />); // Use readOnly to prevent console warnings about controlled components
    expect(screen.getByDisplayValue('Test Value')).toBeInTheDocument();
  });

  it('handles change events', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    const inputElement = screen.getByRole('textbox');
    fireEvent.change(inputElement, { target: { value: 'new value' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(expect.any(Object)); // Expects event object
  });

  it('is disabled when the disabled prop is true', () => {
    render(<Input disabled />);
    const inputElement = screen.getByRole('textbox');
    expect(inputElement).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" />);
    const inputElement = screen.getByRole('textbox');
    expect(inputElement).toHaveClass('custom-input');
  });

  it('forwards ref to the input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByRole('textbox')).toBe(ref.current);
  });
});