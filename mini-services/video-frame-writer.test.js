const { EventEmitter } = require('events');
const { createVideoFrameWriter, getVideoFrameCopies } = require('./video-frame-writer');

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
