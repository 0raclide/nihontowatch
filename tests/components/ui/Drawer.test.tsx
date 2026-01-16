import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Drawer } from '@/components/ui/Drawer';

// Mock useBodyScrollLock
vi.mock('@/hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: vi.fn(),
}));

describe('Drawer Component', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <Drawer isOpen={false} onClose={mockOnClose}>
        <div data-testid="drawer-content">Content</div>
      </Drawer>
    );

    expect(screen.queryByTestId('drawer-content')).not.toBeInTheDocument();
  });

  it('renders children when isOpen is true', () => {
    render(
      <Drawer isOpen={true} onClose={mockOnClose}>
        <div data-testid="drawer-content">Content</div>
      </Drawer>
    );

    expect(screen.getByTestId('drawer-content')).toBeInTheDocument();
    expect(screen.getByTestId('drawer-content')).toHaveTextContent('Content');
  });

  it('renders title when provided', () => {
    render(
      <Drawer isOpen={true} onClose={mockOnClose} title="Test Title">
        <div>Content</div>
      </Drawer>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('does not render title header when title is not provided', () => {
    render(
      <Drawer isOpen={true} onClose={mockOnClose}>
        <div>Content</div>
      </Drawer>
    );

    // Should have the drawer but no close button in header (since no title)
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });

  it('renders close button when title is provided', () => {
    render(
      <Drawer isOpen={true} onClose={mockOnClose} title="Test Title">
        <div>Content</div>
      </Drawer>
    );

    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <Drawer isOpen={true} onClose={mockOnClose} title="Test Title">
        <div>Content</div>
      </Drawer>
    );

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    render(
      <Drawer isOpen={true} onClose={mockOnClose}>
        <div data-testid="drawer-content">Content</div>
      </Drawer>
    );

    // Find backdrop (the element with bg-black/40)
    const backdrop = document.querySelector('.bg-black\\/40');
    expect(backdrop).toBeInTheDocument();

    fireEvent.click(backdrop!);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    render(
      <Drawer isOpen={true} onClose={mockOnClose}>
        <div>Content</div>
      </Drawer>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose on Escape when drawer is closed', () => {
    render(
      <Drawer isOpen={false} onClose={mockOnClose}>
        <div>Content</div>
      </Drawer>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    render(
      <Drawer isOpen={true} onClose={mockOnClose} title="Accessible Drawer">
        <div>Content</div>
      </Drawer>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Accessible Drawer');
  });

  it('has drag handle for gesture-based closing', () => {
    render(
      <Drawer isOpen={true} onClose={mockOnClose}>
        <div>Content</div>
      </Drawer>
    );

    // Find the drag handle (the small rounded bar at top)
    const dragHandle = document.querySelector('.w-10.h-1');
    expect(dragHandle).toBeInTheDocument();
  });

  it('applies animation classes', () => {
    render(
      <Drawer isOpen={true} onClose={mockOnClose}>
        <div>Content</div>
      </Drawer>
    );

    // Check for animation classes
    const backdrop = document.querySelector('.animate-fadeIn');
    const drawer = document.querySelector('.animate-slideUp');

    expect(backdrop).toBeInTheDocument();
    expect(drawer).toBeInTheDocument();
  });

  it('has safe-area-bottom class for notched devices', () => {
    render(
      <Drawer isOpen={true} onClose={mockOnClose}>
        <div>Content</div>
      </Drawer>
    );

    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveClass('safe-area-bottom');
  });

  it('has max-height constraint', () => {
    render(
      <Drawer isOpen={true} onClose={mockOnClose}>
        <div>Content</div>
      </Drawer>
    );

    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveClass('max-h-[85vh]');
  });
});
