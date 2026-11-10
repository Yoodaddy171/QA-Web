import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PopoverContent } from './popover';

const primitive = vi.hoisted(() => ({ portal: vi.fn(), content: vi.fn() }));

vi.mock('@radix-ui/react-popover', () => ({
  Portal: (props: { children: ReactNode; container?: HTMLElement }) => {
    primitive.portal(props);
    return props.children;
  },
  Content: (props: React.ComponentProps<'div'>) => {
    primitive.content(props);
    return <div>{props.children}</div>;
  },
}));

describe('FS-TOUCHPAD-01: modal popover portal contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the supplied modal container without leaking it into content props', () => {
    const container = {} as HTMLElement;
    const html = renderToStaticMarkup(<PopoverContent portalContainer={container} data-lenis-prevent>Events</PopoverContent>);

    expect(primitive.portal.mock.calls[0][0].container).toBe(container);
    expect(primitive.content.mock.calls[0][0]).not.toHaveProperty('portalContainer');
    expect(primitive.content.mock.calls[0][0]['data-lenis-prevent']).toBe(true);
    expect(html).toContain('Events');
  });

  it('preserves the default portal for existing consumers', () => {
    renderToStaticMarkup(<PopoverContent>Events</PopoverContent>);

    expect(primitive.portal.mock.calls[0][0].container).toBeUndefined();
  });
});
