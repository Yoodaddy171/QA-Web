import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BasketballUploadDropzone } from './BasketballUploadDropzone';
import { getShotTimingQuality, ShotMeterGauge } from './basketball/ShotMeterGauge';
import { MissedShotCard } from './basketball/MissedShotCard';

describe('BasketballUploadDropzone', () => {
  it('renders basketball hoop SVG, slingshot file puck, sound toggle, and uploaded counter', () => {
    const html = renderToStaticMarkup(
      <BasketballUploadDropzone
        title="Upload files"
        subtitle="Drag and drop, or take the shot."
        dropLabel="Drop files here"
        uploadedCount={2}
        defaultBadge="DOC"
        onFileSelect={() => {}}
      />
    );
    expect(html).toContain('Upload files');
    expect(html).toContain('Drag and drop, or take the shot.');
    expect(html).toContain('Uploaded 2');
    expect(html).toContain('Drop files here');
    expect(html).toContain('2 PT ZONE');
    expect(html).toContain('3 PT LINE');
    expect(html).toContain('Aim the file inside (2 PT) or outside the arc (3 PT) &amp; release to shoot');
    expect(html).toContain('DOC');
    expect(html).toContain('<svg');
    expect(html).toContain('type="file"');
  });

  it('renders the uploaded file card with extension badge, size, and action button when selectedFile is provided', () => {
    const html = renderToStaticMarkup(
      <BasketballUploadDropzone
        title="Upload Dokumen Knowledge"
        uploadedCount={3}
        selectedFile={{ name: 'document.pdf', size: 2.4 * 1024 * 1024 }}
        actionButtonLabel="Upload Dokumen"
        onActionButtonClick={() => {}}
        onFileSelect={() => {}}
      />
    );
    expect(html).toContain('PDF');
    expect(html).toContain('document.pdf');
    expect(html).toContain('2.4 MB');
    expect(html).toContain('File uploaded successfully');
    expect(html).toContain('Upload Dokumen');
    expect(html).toContain('Uploaded 3');
  });

  it('renders standard clean dropzone without basketball elements when interactiveDropzone is false', () => {
    const html = renderToStaticMarkup(
      <BasketballUploadDropzone
        title="Upload Standard"
        dropLabel="Drop files here"
        interactiveDropzone={false}
        onFileSelect={() => {}}
      />
    );
    expect(html).toContain('Upload Standard');
    expect(html).toContain('Drop files here');
    expect(html).not.toContain('2 PT ZONE');
    expect(html).not.toContain('3 PT LINE');
    expect(html).not.toContain('Aim the file inside');
    expect(html).not.toContain('0 PT');
  });
});

describe('ShotMeterGauge & getShotTimingQuality', () => {
  it('categorizes shot timing correctly across zones', () => {
    expect(getShotTimingQuality(30)).toBe('very_early');
    expect(getShotTimingQuality(75)).toBe('slightly_early');
    expect(getShotTimingQuality(85)).toBe('excellent');
    expect(getShotTimingQuality(95)).toBe('slightly_late');
    expect(getShotTimingQuality(100)).toBe('very_late');
  });

  it('renders pure visual 2K meter gauge without text labels and highlights green sweetspot', () => {
    const html = renderToStaticMarkup(<ShotMeterGauge progress={88} visible={true} />);
    expect(html).toContain('data-testid="shot-meter-gauge"');
    expect(html).toContain('border-emerald-400');
    expect(html).toContain('ring-emerald-400/80');
    // Ensure no rating text labels are rendered inside the meter
    expect(html).not.toContain('EXCELLENT');
    expect(html).not.toContain('VERY EARLY');
    expect(html).not.toContain('AIRBALL');
  });

  it('renders early needle position when progress is early', () => {
    const html = renderToStaticMarkup(<ShotMeterGauge progress={35} visible={true} />);
    expect(html).toContain('data-testid="shot-meter-gauge"');
    expect(html).toContain('bottom:');
    expect(html).not.toContain('AIRBALL ZONE');
  });

  it('returns null when visible is false', () => {
    const html = renderToStaticMarkup(<ShotMeterGauge progress={85} visible={false} />);
    expect(html).toBe('');
  });
});

describe('MissedShotCard', () => {
  it('renders reason, file name, and recovery action buttons', () => {
    const html = renderToStaticMarkup(
      <MissedShotCard
        fileName="laporan_keuangan.xlsx"
        reason="Airball! Tembakan terlalu lemah dan meleset jauh dari ring."
        onRetry={() => {}}
        onDirectUpload={() => {}}
        onCancel={() => {}}
      />
    );
    expect(html).toContain('laporan_keuangan.xlsx');
    expect(html).toContain('Airball!');
    expect(html).toContain('Tembak Lagi');
    expect(html).toContain('Langsung Unggah');
    expect(html).toContain('0 PT');
    expect(html).toContain('Batalkan file');
  });
});
