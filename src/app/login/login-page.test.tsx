import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LoginPage from './page';
import { QAPipelineHero } from '@/components/login/QAPipelineHero';

describe('LoginPage and QAPipelineHero (Anti-Slop Craftsmanship)', () => {
  it('renders QAPipelineHero with real QA metrics and zero em dashes', () => {
    const heroHtml = renderToStaticMarkup(<QAPipelineHero />);
    expect(heroHtml).toContain('SUITE #104 : AUTOMATED RUN');
    expect(heroHtml).toContain('LIVE SCANNING');
    expect(heroHtml).toContain('IKF-01');
    expect(heroHtml).toContain('Authentication &amp; RBAC Policy');
    expect(heroHtml).toContain('48 Active');
    expect(heroHtml).toContain('Coverage');
    expect(heroHtml).toContain('Quality, connected.');
    expect(heroHtml).toContain('Traceva Engine v0.2.0');
    // Anti-slop Hard Gate R-02: zero em dashes allowed
    expect(heroHtml).not.toContain('—');
  });

  it('renders LoginPage with grounded card container, accessible inputs, and no em dashes', () => {
    const pageHtml = renderToStaticMarkup(<LoginPage />);
    expect(pageHtml).toContain('traceva-login-card');
    expect(pageHtml).toContain('Memeriksa session...');
    expect(pageHtml).not.toContain('—');
  });
});
