package com.utils

import com.kms.katalon.core.annotation.Keyword
import com.kms.katalon.core.configuration.RunConfiguration
import com.kms.katalon.core.webui.driver.DriverFactory
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import internal.GlobalVariable
import org.apache.http.client.config.RequestConfig
import org.apache.http.client.methods.HttpPost
import org.apache.http.entity.StringEntity
import org.apache.http.impl.client.CloseableHttpClient
import org.apache.http.impl.client.HttpClients
import org.openqa.selenium.logging.LogEntry
import org.openqa.selenium.logging.LogType
import org.openqa.selenium.devtools.DevTools
import org.openqa.selenium.devtools.HasDevTools
import org.openqa.selenium.remote.RemoteWebDriver
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.Optional
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.function.Consumer

class DevLog {
    private static String relayUrl = ''
    private static String testCaseId = ''
    private static String katalonPath = ''
    private static String runId = ''
    private static String projectId = ''
    private static String browserName = ''
    private static String browserSessionId = ''
    private static String devToolsAttachError = ''
    private static boolean mappingMissing = false
    private static boolean explicitTestCaseIdFallback = false
    private static boolean cdpAvailable = false
    private static boolean fallbackUsed = false
    private static int screenshotIndex = 0
    private static long startedAtMs = 0L
    private static DevTools devTools = null
    private static ConcurrentLinkedQueue cdpEventQueue = new ConcurrentLinkedQueue()
    private static volatile boolean cdpWorkerRunning = false

    @Keyword
    def start(def context) {
        if (!isEnabled()) return
        resetRunState()
        relayUrl = getRelayUrl()
        katalonPath = context?.testCaseId ?: context?.getTestCaseId() ?: ''
        testCaseId = resolveMappedTestCaseId(katalonPath)
        projectId = getProjectId()
        runId = createRunId()
        startedAtMs = System.currentTimeMillis()
        sendStructuredLog('execution', [
            eventType: 'run.started',
            message: "Starting Automation: ${katalonPath ?: 'Unknown Katalon Test Case'}"
        ])
        if (mappingMissing) {
            sendStructuredLog('console', [
                eventType: 'warning',
                level: 'WARNING',
                message: "QA-Web testcase mapping not found for '${katalonPath}'. Events use a clearly marked fallback ID and will not appear under a mapped QA-Web testcase."
            ])
        }
    }

    @Keyword
    def finish(def context) {
        if (!isEnabled()) return
        flushBrowserCapture()
        if (captureScreenshotsEnabled()) captureScreenshot('run-finished')
        String status = context?.testCaseStatus ?: context?.getTestCaseStatus() ?: 'UNKNOWN'
        long durationMs = startedAtMs ? System.currentTimeMillis() - startedAtMs : 0L
        sendStructuredLog('execution', [
            eventType: 'run.finished',
            status: status,
            durationMs: durationMs,
            message: "Execution complete. Status: ${status}. Duration: ${durationMs}ms"
        ])
        devTools = null
        cdpWorkerRunning = false
        runId = ''
    }

    @Keyword
    def step(String message) {
        ensureBrowserAttached()
        writeLocalComment(message)
        sendStructuredLog('execution', [eventType: 'step', message: message])
        if (captureScreenshotsEnabled()) captureScreenshot(message)
        flushBrowserCapture()
    }

    @Keyword
    def console(String level, String message) {
        if (!captureConsoleEnabled()) return
        sendStructuredLog('console', [level: level ?: 'INFO', message: message ?: ''])
    }

    @Keyword
    def network(String method, String url, def responseOrData = null) {
        if (!captureNetworkEnabled()) return
        try {
            Map data = [
                event: 'Response',
                method: (method ?: 'TRACE').toString().toUpperCase(),
                url: url ?: '',
                status: extractStatus(responseOrData),
                success: extractSuccess(responseOrData),
                data: extractBody(responseOrData)
            ]
            sendStructuredLog('network', data)
        } catch (Exception e) {
            System.out.println('[DevLog.network] ' + e.message)
        }
    }

    @Keyword
    def attachBrowser() {
        if (!isEnabled()) return
        ensureBrowserAttached()
    }

    @Keyword
    def ensureBrowserAttached() {
        if (!isEnabled()) return
        ensureDevToolsAttached()
    }

    @Keyword
    def flushBrowserCapture() {
        if (!isEnabled()) return
        drainCdpQueue()
        sniffBrowserLogs()
        sniffPerformanceLogs()
    }

    @Keyword
    def setTestCaseId(String id) {
        if (!id) return
        testCaseId = id
        explicitTestCaseIdFallback = true
        mappingMissing = false
        System.out.println('[DevLog] Explicit testCaseId override is deprecated. Prefer Include/testcase-map.json.')
    }

    @Keyword
    def captureScreenshot(String label = 'screenshot') {
        if (!isEnabled() || !captureScreenshotsEnabled() || !runId || !testCaseId) return
        try {
            File dir = new File(RunConfiguration.getProjectDir(), "Reports/WebQA/${safePath(runId)}")
            dir.mkdirs()
            screenshotIndex++
            String fileName = String.format('%03d-%s.png', screenshotIndex, safePath(label ?: 'screenshot'))
            File screenshot = new File(dir, fileName)
            WebUI.takeScreenshot(screenshot.absolutePath)
            sendStructuredLog('screenshot', [
                eventType: 'screenshot',
                message: "Screenshot captured: ${label ?: 'screenshot'}",
                screenshotPath: screenshot.absolutePath
            ])
        } catch (Exception e) {
            sendStructuredLog('console', [
                eventType: 'warning',
                level: 'WARNING',
                message: 'Screenshot capture failed: ' + e.message,
                metadata: [screenshotLabel: label]
            ])
        }
    }

    static boolean isEnabled() {
        return String.valueOf(GlobalVariable.webQaEnabled).toBoolean()
    }

    static String getRelayUrl() {
        return String.valueOf(GlobalVariable.webQaRelayUrl ?: 'http://127.0.0.1:3001/log')
    }

    static String getProjectId() {
        return String.valueOf(GlobalVariable.webQaProjectId ?: '')
    }

    static String getDefaultTestCaseId() {
        return String.valueOf(GlobalVariable.webQaDefaultTestCaseId ?: '')
    }

    static boolean captureScreenshotsEnabled() {
        return String.valueOf(GlobalVariable.webQaCaptureScreenshots).toBoolean()
    }

    static boolean captureNetworkEnabled() {
        return String.valueOf(GlobalVariable.webQaCaptureNetwork).toBoolean()
    }

    static boolean captureConsoleEnabled() {
        try {
            return String.valueOf(GlobalVariable.webQaCaptureConsole).toBoolean()
        } catch (Exception ignored) {
            return true
        }
    }

    static String resolveMappedTestCaseId(String path) {
        File mapFile = new File(RunConfiguration.getProjectDir(), 'Include/testcase-map.json')
        if (!mapFile.exists()) {
            System.out.println('[DevLog] Mapping file not found: ' + mapFile.absolutePath)
            return fallbackTestCaseId(path)
        }

        try {
            def map = new JsonSlurper().parse(mapFile)
            String mapped = map[path] ?: map[path?.replace('Test Cases/', '')]
            if (mapped) {
                return mapped
            }
            System.out.println('[DevLog] Mapping not found for: ' + path)
        } catch (Exception e) {
            System.out.println('[DevLog] Failed reading mapping: ' + e.message)
        }
        return fallbackTestCaseId(path)
    }

    static String fallbackTestCaseId(String path) {
        mappingMissing = true
        String configuredFallback = getDefaultTestCaseId()
        if (configuredFallback) {
            explicitTestCaseIdFallback = true
            return configuredFallback
        }
        return "unmapped:${path ?: 'unknown-katalon-testcase'}"
    }

    static void sendStructuredLog(String category, Map data) {
        if (!isEnabled()) return
        if (category == 'network' && !captureNetworkEnabled()) return
        try {
            String id = testCaseId
            if (!id) {
                System.out.println('[DevLog] testCaseId is empty. Log skipped.')
                return
            }

            updateBrowserMetadata()
            if (!runId) runId = createRunId()
            String eventType = resolveEventType(category, data)
            String source = String.valueOf(data.source ?: (fallbackUsed ? 'katalon-fallback' : 'katalon-devlog'))
            Map automationEvent = [
                schemaVersion: 1,
                eventId: createEventId(),
                runId: runId,
                mode: 'katalon',
                testCaseId: id,
                testCaseName: katalonPath,
                projectId: projectId ?: null,
                source: source,
                eventType: eventType,
                stepName: data.stepName,
                status: data.status,
                message: data.message ?: (category == 'network' ? 'Network Trace' : ''),
                timestamp: Instant.now().toString(),
                durationMs: data.durationMs ?: data.duration,
                url: data.url,
                method: data.method,
                requestHeaders: data.requestHeaders ?: (data.event == 'Request' ? data.headers : null),
                requestBody: data.requestBody,
                responseStatus: category == 'network' ? data.status : null,
                responseHeaders: data.responseHeaders ?: (data.event == 'Response' ? data.headers : null),
                responseBody: data.responseBody ?: data.data,
                screenshotPath: data.screenshotPath,
                evidencePath: data.evidencePath,
                browserName: browserName ?: null,
                browserSessionId: browserSessionId ?: null,
                cdpAvailable: cdpAvailable,
                fallbackUsed: fallbackUsed,
                metadata: [
                    katalonPath: katalonPath,
                    relativeMs: relativeMs(),
                    level: data.level,
                    mappingMissing: mappingMissing,
                    explicitTestCaseIdFallback: explicitTestCaseIdFallback,
                    devToolsAttachError: devToolsAttachError ?: null
                ] + (data.metadata ?: [:])
            ].findAll { key, value -> value != null }

            Map payload = [
                type: 'log',
                automationEvent: automationEvent
            ] + automationEvent
            switch (category) {
                case 'console':
                    payload += [
                        level: data.level ?: 'INFO',
                        log: data.message ?: '',
                        relativeMs: relativeMs()
                    ]
                    break
                case 'network':
                    payload += [
                        network: data,
                        log: 'Network Trace',
                        relativeMs: relativeMs()
                    ]
                    break
                case 'screenshot':
                    payload += [
                        log: data.message ?: 'Screenshot captured',
                        relativeMs: relativeMs()
                    ]
                    break
                case 'execution':
                default:
                    payload += [
                        log: data.message ?: '',
                        relativeMs: relativeMs()
                    ]
                    break
            }

            RequestConfig config = RequestConfig.custom()
                .setConnectTimeout(1000)
                .setSocketTimeout(1000)
                .setConnectionRequestTimeout(1000)
                .build()

            HttpPost post = new HttpPost(relayUrl ?: getRelayUrl())
            post.setHeader('Content-Type', 'application/json')
            post.setEntity(new StringEntity(JsonOutput.toJson(payload), 'UTF-8'))
            CloseableHttpClient client = HttpClients.custom()
                .setDefaultRequestConfig(config)
                .build()
            client.execute(post).close()
            client.close()
        } catch (Exception e) {
            System.out.println('[DevLog] Relay offline or send failed: ' + e.message)
        }
    }

    static void writeLocalComment(String message) {
        String timestamp = new SimpleDateFormat('yyyy-MM-dd HH:mm:ss.SSS').format(new Date())
        String formatted = "[${timestamp}] ${message}"
        try { WebUI.comment(message) } catch (Exception ignored) {}
        System.out.println(formatted)
    }

    static long relativeMs() {
        return startedAtMs ? Math.max(0L, System.currentTimeMillis() - startedAtMs) : 0L
    }

    static Integer extractStatus(def responseOrData) {
        try {
            if (responseOrData instanceof Map && responseOrData.status != null) return responseOrData.status as Integer
            if (responseOrData?.statusCode != null) return responseOrData.statusCode as Integer
        } catch (Exception ignored) {}
        return 0
    }

    static Boolean extractSuccess(def responseOrData) {
        try {
            if (responseOrData instanceof Map && responseOrData.success != null) return responseOrData.success as Boolean
            if (responseOrData?.success != null) return responseOrData.success as Boolean
            Integer status = extractStatus(responseOrData)
            return status >= 200 && status < 400
        } catch (Exception ignored) {}
        return false
    }

    static Object extractBody(def responseOrData) {
        try {
            def body = responseOrData?.responseText ?: responseOrData?.data ?: responseOrData
            String text = body == null ? '' : String.valueOf(body)
            return text.length() > 3000 ? text.substring(0, 3000) + '... [truncated]' : text
        } catch (Exception ignored) {
            return ''
        }
    }

    static void maybeSniffLogs() {
        ensureDevToolsAttached()
        drainCdpQueue()
        sniffBrowserLogs()
        sniffPerformanceLogs()
    }

    static void ensureDevToolsAttached() {
        if (devTools != null) return
        try {
            DriverFactory.getWebDriver()
            initDevTools()
        } catch (Exception ignored) {}
    }

    static void sniffBrowserLogs() {
        if (!captureConsoleEnabled()) return
        try {
            def driver = DriverFactory.getWebDriver()
            def entries = driver.manage().logs().get(LogType.BROWSER).all
            entries?.each { LogEntry entry ->
                if (!cdpAvailable) fallbackUsed = true
                sendStructuredLog('console', [
                    source: 'katalon-fallback',
                    level: entry.level?.name()?.toUpperCase() ?: 'INFO',
                    message: '[BrowserLog Fallback] ' + entry.message
                ])
            }
        } catch (Exception ignored) {}
    }

    static void sniffPerformanceLogs() {
        if (!captureNetworkEnabled()) return
        try {
            def driver = DriverFactory.getWebDriver()
            def entries = driver.manage().logs().get(LogType.PERFORMANCE).all
            entries?.each { LogEntry entry ->
                try {
                    if (!cdpAvailable) fallbackUsed = true
                    def outer = new JsonSlurper().parseText(entry.message)
                    def message = outer?.message
                    String method = String.valueOf(message?.method ?: '')
                    def params = message?.params

                    if (method == 'Network.requestWillBeSent') {
                        def req = params?.request
                        if (!req?.url) return
                        sendStructuredLog('network', [
                            source: 'katalon-fallback',
                            event: 'Request',
                            method: req?.method,
                            url: req?.url,
                            headers: req?.headers,
                            success: true
                        ])
                    }

                    if (method == 'Network.responseReceived') {
                        def res = params?.response
                        if (!res?.url) return
                        Integer status = res?.status != null ? (res.status as Integer) : 0
                        sendStructuredLog('network', [
                            source: 'katalon-fallback',
                            event: 'Response',
                            method: params?.type ?: 'Response',
                            url: res?.url,
                            status: status,
                            success: status > 0 ? status < 400 : true,
                            headers: res?.headers
                        ])
                    }
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
    }

    static void initDevTools() {
        try {
            def driver = DriverFactory.getWebDriver()
            updateBrowserMetadata()
            if (!(driver instanceof HasDevTools)) {
                cdpAvailable = false
                fallbackUsed = true
                devToolsAttachError = 'Browser driver does not support DevTools.'
                sendStructuredLog('console', [source: 'katalon-fallback', eventType: 'warning', level: 'WARNING', message: devToolsAttachError])
                return
            }

            devTools = ((HasDevTools) driver).getDevTools()
            devTools.createSession()

            String version = ['v148', 'v143', 'v138', 'v129', 'v128', 'v120', 'v112', 'v85'].find { v ->
                try { Class.forName("org.openqa.selenium.devtools.${v}.network.Network"); return true }
                catch (Exception ignored) { return false }
            }
            if (!version) {
                cdpAvailable = false
                fallbackUsed = true
                devToolsAttachError = 'No selenium-devtools version found. Fallback browser logs only.'
                sendStructuredLog('console', [source: 'katalon-fallback', eventType: 'warning', level: 'WARNING', message: devToolsAttachError])
                devTools = null
                return
            }

            def netClass = Class.forName("org.openqa.selenium.devtools.${version}.network.Network")
            def conClass = Class.forName("org.openqa.selenium.devtools.${version}.console.Console")

            try {
                def netEnable = netClass.methods.find { it.name == 'enable' }
                Object[] netArgs = new Object[netEnable.parameterTypes.length]
                for (int i = 0; i < netArgs.length; i++) {
                    netArgs[i] = netEnable.parameterTypes[i] == Optional ? Optional.empty() : null
                }
                devTools.send(netEnable.invoke(null, netArgs))
                def conEnable = conClass.methods.find { it.name == 'enable' }
                if (conEnable) devTools.send(conEnable.invoke(null))
            } catch (Exception ignored) {}

            registerListener(netClass, 'requestWillBeSent') { ev ->
                try {
                    def req = ev.request
                    queueCdp('network', [
                        event: 'Request',
                        method: req?.method,
                        url: req?.url,
                        headers: req?.headers?.toString()?.take(800)
                    ])
                } catch (Exception ignored) {}
            }

            registerListener(netClass, 'responseReceived') { ev ->
                try {
                    def res = ev.response
                    queueCdp('network', [
                        event: 'Response',
                        method: ev.type?.toString(),
                        url: res?.url,
                        status: res?.status as Integer,
                        success: (res?.status as Integer) < 400,
                        headers: res?.headers?.toString()?.take(800)
                    ])
                } catch (Exception ignored) {}
            }

            if (captureConsoleEnabled()) {
                registerListener(conClass, 'messageAdded') { ev ->
                    try {
                        def msg = ev.message
                        queueCdp('console', [
                            level: msg?.level?.toString()?.toUpperCase() ?: 'INFO',
                            message: msg?.text?.toString() ?: String.valueOf(msg)
                        ])
                    } catch (Exception ignored) {}
                }
            }

            cdpAvailable = true
            fallbackUsed = false
            devToolsAttachError = ''
            startCdpWorker()
            sendStructuredLog('console', [source: 'katalon-devtools', level: 'INFO', message: "DevTools attached using ${version}."])
        } catch (Exception e) {
            devTools = null
            cdpAvailable = false
            fallbackUsed = true
            devToolsAttachError = e.message ?: e.class.simpleName
            System.out.println('[DevLog] DevTools init failed, using performance-log fallback: ' + e.message)
            sendStructuredLog('console', [
                source: 'katalon-fallback',
                eventType: 'warning',
                level: 'WARNING',
                message: 'CDP auto-capture unavailable for this Chrome/Selenium version. Using fallback capture. Browser network may be partial; manual DevLog.network() still works.'
            ])
        }
    }

    static String resolveEventType(String category, Map data) {
        if (data.eventType) return String.valueOf(data.eventType)
        if (category == 'network') return String.valueOf(data.event ?: '').equalsIgnoreCase('Request') ? 'network.request' : 'network.response'
        if (category == 'console') return 'console'
        if (category == 'screenshot') return 'screenshot'
        return 'step'
    }

    static String createEventId() {
        return UUID.randomUUID().toString()
    }

    static String createRunId() {
        return 'katalon-' + UUID.randomUUID().toString()
    }

    static String safePath(String value) {
        return String.valueOf(value ?: 'item').replaceAll('[^a-zA-Z0-9._-]+', '_').take(80)
    }

    static void resetRunState() {
        testCaseId = ''
        katalonPath = ''
        runId = ''
        projectId = ''
        browserName = ''
        browserSessionId = ''
        devToolsAttachError = ''
        mappingMissing = false
        explicitTestCaseIdFallback = false
        cdpAvailable = false
        fallbackUsed = false
        screenshotIndex = 0
        startedAtMs = 0L
        devTools = null
        cdpEventQueue.clear()
        cdpWorkerRunning = false
    }

    static void updateBrowserMetadata() {
        try {
            def driver = DriverFactory.getWebDriver()
            if (driver instanceof RemoteWebDriver) {
                browserName = String.valueOf(driver.capabilities?.browserName ?: browserName)
                browserSessionId = String.valueOf(driver.sessionId ?: browserSessionId)
            }
        } catch (Exception ignored) {}
    }

    static void registerListener(def domainClass, String eventMethod, Closure callback) {
        try {
            def eventObj = domainClass.methods.find { it.name == eventMethod && it.parameterTypes.length == 0 }?.invoke(null)
            if (!eventObj) return
            def addMethod = devTools.class.methods.find {
                it.name == 'addListener' && it.parameterTypes.length == 2 && it.parameterTypes[1].name.contains('Consumer')
            }
            if (!addMethod) return
            addMethod.invoke(devTools, eventObj, new Consumer<Object>() {
                @Override void accept(Object ev) { callback(ev) }
            })
        } catch (Exception e) {
            System.out.println('[DevLog] Listener failed for ' + eventMethod + ': ' + e.message)
        }
    }

    static void queueCdp(String category, Map data) {
        cdpEventQueue.offer([category: category, data: [source: 'katalon-devtools'] + data])
    }

    static void startCdpWorker() {
        if (cdpWorkerRunning) return
        cdpWorkerRunning = true
        Thread.startDaemon('DevLog-CDP-Worker') {
            while (cdpWorkerRunning) {
                drainCdpQueue()
                Thread.sleep(250)
            }
        }
    }

    static void drainCdpQueue() {
        while (!cdpEventQueue.isEmpty()) {
            def event = cdpEventQueue.poll()
            if (event) sendStructuredLog(event.category as String, event.data as Map)
        }
    }
}
