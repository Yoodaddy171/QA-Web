function createVideoFrameWriter(stream, onFrameWritten) {
  const queue = [];
  let backpressured = false;
  let ending = false;

  const flush = () => {
    if (backpressured || !stream.writable) return;
    while (queue.length) {
      const item = queue[0];
      const canContinue = stream.write(item.buffer);
      item.copies -= 1;
      onFrameWritten();
      if (item.copies === 0) queue.shift();
      if (!canContinue) {
        backpressured = true;
        return;
      }
    }
    if (ending) stream.end();
  };

  stream.on('drain', () => {
    backpressured = false;
    flush();
  });

  return {
    enqueue(buffer, copies) {
      if (!stream.writable || copies < 1) return;
      queue.push({ buffer, copies });
      flush();
    },
    end() {
      ending = true;
      flush();
    },
  };
}

function getVideoFrameCopies(elapsedMs, fps) {
  return Math.max(1, Math.round(Math.max(0, elapsedMs) * fps / 1000));
}

module.exports = { createVideoFrameWriter, getVideoFrameCopies };
