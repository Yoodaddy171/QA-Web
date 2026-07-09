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

// Accumulator model: copies are derived from the GLOBAL elapsed time versus
// frames already queued, so per-interval rounding errors can never accumulate.
// The video timeline stays locked to the session wall clock (max drift: 1/2 frame).
function getVideoFrameCopies(totalElapsedMs, fps, framesAlreadyQueued = 0) {
  const targetFrames = Math.round(Math.max(0, totalElapsedMs) * fps / 1000);
  if (framesAlreadyQueued <= 0) return Math.max(1, targetFrames);
  return Math.max(0, targetFrames - framesAlreadyQueued);
}

function markInterruptedVideoFailed(metadata, reason = 'Video finalization was interrupted.') {
  if (!['starting', 'recording', 'finalizing'].includes(metadata?.video?.status)) return null;
  return {
    ...metadata,
    video: { ...metadata.video, status: 'failed', processingPercent: undefined },
    warnings: Array.from(new Set([...(metadata.warnings || []), reason])),
  };
}

module.exports = { createVideoFrameWriter, getVideoFrameCopies, markInterruptedVideoFailed };
