const { EventEmitter } = require('events');
const { createVideoFrameWriter, getVideoFrameCopies, markInterruptedVideoFailed } = require('./video-frame-writer');

it('preserves every frame copy across stream backpressure', () => {
  const stream = new EventEmitter();
  stream.writable = true;
  stream.write = vi.fn()
    .mockReturnValueOnce(false)
    .mockReturnValue(true);
  stream.end = vi.fn();
  const onFrame = vi.fn();
  const writer = createVideoFrameWriter(stream, onFrame);

  writer.enqueue(Buffer.from('frame'), 3);
  writer.end();
  expect(stream.write).toHaveBeenCalledTimes(1);
  expect(stream.end).not.toHaveBeenCalled();

  stream.emit('drain');
  expect(stream.write).toHaveBeenCalledTimes(3);
  expect(onFrame).toHaveBeenCalledTimes(3);
  expect(stream.end).toHaveBeenCalledOnce();
});

it('preserves long wall-clock gaps instead of capping video time', () => {
  expect(getVideoFrameCopies(10_000, 12)).toBe(120);
});

it('always emits at least one copy for the first frame', () => {
  expect(getVideoFrameCopies(0, 30, 0)).toBe(1);
  expect(getVideoFrameCopies(5, 30, 0)).toBe(1);
});

it('emits zero copies when the timeline is already caught up', () => {
  // 1000ms at 30fps = 30 frames target; 30 already queued -> nothing to add.
  expect(getVideoFrameCopies(1000, 30, 30)).toBe(0);
  // Even if the clock briefly reads behind the queue, never go negative.
  expect(getVideoFrameCopies(900, 30, 30)).toBe(0);
});

it('never accumulates rounding drift across jittery capture intervals', () => {
  // Worst case for the old per-interval rounding: captures every 45ms at
  // 30fps (1.35 frames/interval) used to round to 1 -> video ran ~26% fast.
  const fps = 30;
  let queued = 0;
  let elapsed = 0;
  const intervals = Array.from({ length: 400 }, (_, i) => 45 + ((i * 7) % 23)); // 45-67ms jitter
  for (const interval of intervals) {
    elapsed += interval;
    queued += getVideoFrameCopies(elapsed, fps, queued);
  }
  const targetFrames = Math.round(elapsed * fps / 1000);
  expect(Math.abs(queued - targetFrames)).toBeLessThanOrEqual(1);
});

it('marks interrupted finalization as failed without changing completed video', () => {
  expect(markInterruptedVideoFailed({ video: { status: 'finalizing' }, warnings: [] })).toMatchObject({
    video: { status: 'failed' },
  });
  expect(markInterruptedVideoFailed({ video: { status: 'ready' } })).toBeNull();
});
