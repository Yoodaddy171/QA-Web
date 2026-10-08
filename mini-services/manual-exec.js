const MAX_RESPONSE_BYTES = 64 * 1024;

function boundedResponse(payload) {
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized) <= MAX_RESPONSE_BYTES) return payload;
  // Keep the envelope valid JSON; never return a silently chopped object.
  return {
    success: payload.success,
    result: null,
    exceptionDetails: payload.exceptionDetails ? { text: 'JavaScript exception (details truncated)' } : null,
    truncated: true,
    originalBytes: Buffer.byteLength(serialized),
    preview: serialized.slice(0, 6000),
  };
}

async function executeManual({ session, sessionInfo, ownerKey, body }) {
  if (session && session.ownerKey !== ownerKey) {
    return { status: 403, payload: { success: false, error: 'Manual capture session ownership mismatch' } };
  }
  if (!session?.active || !sessionInfo?.cdp) {
    return { status: 404, payload: { success: false, error: 'Manual capture session not found or not active' } };
  }
  const timeoutMs = body?.timeoutMs ?? 30000;
  if (!body || Array.isArray(body) || typeof body.expression !== 'string' || !body.expression.trim()
      || Buffer.byteLength(body.expression) > 65536 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
    return { status: 400, payload: { success: false, error: 'expression must be nonempty (max 65536 bytes); timeoutMs must be an integer from 1 to 120000' } };
  }
  try {
    const evaluated = await sessionInfo.cdp.send('Runtime.evaluate', {
      expression: body.expression, awaitPromise: true, returnByValue: true,
    }, timeoutMs);
    return { status: 200, payload: boundedResponse({
      success: true,
      result: evaluated.result?.value ?? evaluated.result?.unserializableValue ?? null,
      exceptionDetails: evaluated.exceptionDetails ?? null,
    }) };
  } catch (_) {
    // A transport timeout does not undo or necessarily stop page-side mutations.
    return { status: 500, payload: { success: false, error: 'CDP execution failed or timed out', outcome: 'UNKNOWN', warning: 'The script may still be running. Inspect capture and target state before retrying.' } };
  }
}

module.exports = { executeManual, boundedResponse, MAX_RESPONSE_BYTES };
