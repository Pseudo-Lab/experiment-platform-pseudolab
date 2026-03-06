import { render, screen, fireEvent } from '@testing-library/react';
import { Button, buttonVariants } from '@/components/ui/button'; // Adjust import path as necessary
import { expect } from 'vitest';

describe('Button Component', () => {
  it('renders correctly with default props', () => {
    render(<Button>Click Me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass(buttonVariants({ variant: 'default', size: 'default' }));
  });

  it('renders with a different variant', () => {
    render(<Button variant="secondary">Secondary Button</Button>);
    const button = screen.getByRole('button', { name: /secondary button/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass(buttonVariants({ variant: 'secondary', size: 'default' }));
    expect(button).not.toHaveClass(buttonVariants({ variant: 'default', size: 'default' }));
  });

  it('renders with a different size', () => {
    render(<Button size="sm">Small Button</Button>);
    const button = screen.getByRole('button', { name: /small button/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary'); // Default variant class
    expect(button).toHaveClass('h-8'); // sm size class
    expect(button).toHaveClass('px-3'); // sm size class
    expect(button).toHaveClass('rounded-md'); // Should still be present (base and sm)
    expect(button).toHaveClass('text-xs'); // sm size class, overrides text-sm
    expect(button).not.toHaveClass('text-sm'); // Ensure text-sm is overridden
    expect(button).not.toHaveClass(buttonVariants({ variant: 'default', size: 'default' }));
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Test Button</Button>);
    const button = screen.getByRole('button', { name: /test button/i });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders as a child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    const linkButton = screen.getByRole('link', { name: /link button/i });
    expect(linkButton).toBeInTheDocument();
    expect(linkButton).toHaveAttribute('href', '/test');
    // Ensure button classes are applied to the child element
    expect(linkButton).toHaveClass(buttonVariants({ variant: 'default', size: 'default' }));
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>);
    const button = screen.getByRole('button', { name: /disabled button/i });
    expect(button).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom Class Button</Button>);
    const button = screen.getByRole('button', { name: /custom class button/i });
    expect(button).toHaveClass('custom-class');
  });
});
