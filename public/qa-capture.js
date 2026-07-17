(function () {
  var params = new URLSearchParams(window.location.search);
  var enabled = params.get('qaCapture') === '1';
  var testCaseId = params.get('qaTestCaseId') || params.get('caseId') || '';
  var sessionId = params.get('qaSessionId') || '';
  var relay = params.get('qaRelay') || 'http://127.0.0.1:3001';
  var relayToken = params.get('qaToken') || '';
  var maxTextLength = 4000;

  if (!enabled || !testCaseId || !sessionId || window.__qaManualCaptureInstalled) return;
  window.__qaManualCaptureInstalled = true;

  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  var originalXhrOpen = window.XMLHttpRequest && window.XMLHttpRequest.prototype.open;
  var originalXhrSend = window.XMLHttpRequest && window.XMLHttpRequest.prototype.send;
  var originalConsole = {};
  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    originalConsole[level] = console[level] ? console[level].bind(console) : function () {};
  });

  function truncate(value) {
    if (value == null) return value;
    var text = typeof value === 'string' ? value : safeStringify(value);
    if (text.length <= maxTextLength) return text;
    return text.slice(0, maxTextLength) + '... [truncated]';
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }

  function redactValue(key, value) {
    var sensitive = /authorization|cookie|token|password|secret|apikey|api-key|access_token|refresh_token/i;
    if (sensitive.test(String(key))) return '[REDACTED]';
    if (value && typeof value === 'object') return redactObject(value);
    return value;
  }

  function redactObject(input) {
    if (!input || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.slice(0, 20).map(function (item) { return redactObject(item); });
    var output = {};
    Object.keys(input).slice(0, 80).forEach(function (key) {
      output[key] = redactValue(key, input[key]);
    });
    return output;
  }

  function headersToObject(headers) {
    var output = {};
    if (!headers) return output;
    try {
      if (typeof Headers !== 'undefined' && headers instanceof Headers) {
        headers.forEach(function (value, key) {
          output[key] = redactValue(key, value);
        });
      } else if (Array.isArray(headers)) {
        headers.forEach(function (pair) {
          if (pair && pair.length >= 2) output[pair[0]] = redactValue(pair[0], pair[1]);
        });
      } else if (typeof headers === 'object') {
        Object.keys(headers).forEach(function (key) {
          output[key] = redactValue(key, headers[key]);
        });
      }
    } catch (_) {}
    return output;
  }

  function sendLog(payload) {
    var logPayload = Object.assign({
      type: 'log',
      source: 'manual-capture',
      testCaseId: testCaseId,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
    }, payload);

    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(logPayload)], { type: 'application/json' });
        if (navigator.sendBeacon(relay.replace(/\/$/, '') + '/log?access_token=' + encodeURIComponent(relayToken), blob)) return;
      }
    } catch (_) {}

    try {
      if (originalFetch) {
        originalFetch(relay.replace(/\/$/, '') + '/log?access_token=' + encodeURIComponent(relayToken), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload),
          keepalive: true,
        }).catch(function () {});
      }
    } catch (_) {}
  }

  function serializeConsoleArgs(args) {
    return Array.prototype.slice.call(args).map(function (arg) {
      if (arg instanceof Error) {
        return { name: arg.name, message: arg.message, stack: truncate(arg.stack) };
      }
      if (arg && typeof arg === 'object') return truncate(redactObject(arg));
      return truncate(String(arg));
    }).join(' ');
  }

  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    console[level] = function () {
      var normalizedLevel = level === 'error' ? 'SEVERE' : level === 'warn' ? 'WARNING' : 'INFO';
      sendLog({ level: normalizedLevel, console: true, log: serializeConsoleArgs(arguments) });
      return originalConsole[level].apply(console, arguments);
    };
  });

  window.addEventListener('error', function (event) {
    sendLog({
      level: 'SEVERE',
      console: true,
      log: {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: truncate(event.error && event.error.stack),
      },
    });
  });

  window.addEventListener('unhandledrejection', function (event) {
    sendLog({
      level: 'SEVERE',
      console: true,
      log: {
        message: 'Unhandled promise rejection',
        reason: truncate(event.reason),
      },
    });
  });

  if (originalFetch) {
    window.fetch = function (input, init) {
      var startedAt = Date.now();
      var requestUrl = typeof input === 'string' ? input : input && input.url;
      var method = (init && init.method) || (input && input.method) || 'GET';
      var headers = headersToObject((init && init.headers) || (input && input.headers));
      var requestBody = init && init.body ? truncate(init.body) : undefined;

      return originalFetch(input, init).then(function (response) {
        var duration = Date.now() - startedAt;
        try {
          response.clone().text().then(function (text) {
            sendLog({
              log: 'Network Trace',
              network: {
                event: 'Response',
                method: method,
                url: requestUrl || response.url,
                status: response.status,
                success: response.ok,
                duration: duration,
                headers: headersToObject(response.headers),
                data: {
                  requestHeaders: headers,
                  requestBody: requestBody,
                  responseBody: truncate(text),
                },
              },
            });
          }).catch(function () {});
        } catch (_) {}
        return response;
      }).catch(function (error) {
        sendLog({
          log: 'Network Trace',
          network: {
            event: 'Error',
            method: method,
            url: requestUrl || '',
            status: 0,
            success: false,
            duration: Date.now() - startedAt,
            headers: headers,
            data: { error: error && error.message ? error.message : String(error) },
          },
        });
        throw error;
      });
    };
  }

  if (originalXhrOpen && originalXhrSend) {
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__qaCapture = { method: method || 'GET', url: String(url || ''), startedAt: 0 };
      return originalXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      var xhr = this;
      var meta = xhr.__qaCapture || { method: 'GET', url: '', startedAt: 0 };
      meta.startedAt = Date.now();
      xhr.addEventListener('loadend', function () {
        sendLog({
          log: 'Network Trace',
          network: {
            event: 'Response',
            method: meta.method,
            url: meta.url,
            status: xhr.status,
            success: xhr.status >= 200 && xhr.status < 400,
            duration: Date.now() - meta.startedAt,
            headers: {},
            data: {
              requestBody: truncate(body),
              responseBody: truncate(xhr.responseText),
            },
          },
        });
      });
      return originalXhrSend.apply(this, arguments);
    };
  }

  window.addEventListener('click', function (event) {
    var target = event.target;
    var targetLabel = '';
    try {
      targetLabel = target && target.closest
        ? target.closest('button,a,input,select,textarea,[role="button"],[data-testid],[aria-label]') || target
        : target;
      targetLabel = targetLabel
        ? [
            targetLabel.tagName,
            targetLabel.getAttribute && (targetLabel.getAttribute('aria-label') || targetLabel.getAttribute('data-testid') || targetLabel.id || targetLabel.name),
            targetLabel.textContent && targetLabel.textContent.trim().slice(0, 80),
          ].filter(Boolean).join(' ')
        : '';
    } catch (_) {}

    sendLog({
      level: 'INFO',
      console: false,
      log: 'Manual Click',
      interaction: {
        type: 'click',
        x: event.clientX,
        y: event.clientY,
        viewportWidth: window.innerWidth || document.documentElement.clientWidth || 0,
        viewportHeight: window.innerHeight || document.documentElement.clientHeight || 0,
        target: truncate(targetLabel),
      },
    });
  }, true);

  sendLog({
    level: 'INFO',
    console: true,
    log: 'Manual capture logger active',
  });
})();
