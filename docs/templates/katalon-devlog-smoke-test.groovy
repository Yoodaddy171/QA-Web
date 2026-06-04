import com.kms.katalon.core.model.FailureHandling as FailureHandling
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import internal.GlobalVariable as GlobalVariable

/*
 * DevLog semi-auto smoke test.
 *
 * Prasyarat:
 * 1. Relay QA Desk hidup: node mini-services/ws-server.js
 * 2. Test Listener DevLogListener.groovy sudah aktif.
 * 3. Custom Keyword com.utils.DevLog.groovy sudah ada.
 * 4. Include/testcase-map.json berisi path testcase ini.
 *    Contoh:
 *    {
 *      "Test Cases/QA Web automation": "UUID_QA_DESK"
 *    }
 *
 * Tujuan script:
 * - Membuktikan listener mengirim Starting Automation dan Execution complete.
 * - Membuktikan DevLog.step masuk tab Execution.
 * - Membuktikan attachBrowser/CDP bisa menangkap console browser.
 * - Membuktikan DevLog.network masuk tab Network.
 */

String targetUrl = 'https://example.com'

try {
    String configuredTargetUrl = String.valueOf(GlobalVariable.targetUrl ?: '')
    if (configuredTargetUrl.trim()) targetUrl = configuredTargetUrl.trim()
} catch (Exception ignored) {
    // targetUrl global optional.
}

try {
    CustomKeywords.'com.utils.DevLog.step'('Smoke test started')

    WebUI.openBrowser('')
    WebUI.maximizeWindow()

    CustomKeywords.'com.utils.DevLog.step'('Browser opened, attaching DevTools capture')
    CustomKeywords.'com.utils.DevLog.attachBrowser'()

    CustomKeywords.'com.utils.DevLog.step'("Navigate to target URL: ${targetUrl}")
    WebUI.navigateToUrl(targetUrl)
    WebUI.waitForPageLoad(10, FailureHandling.OPTIONAL)

    CustomKeywords.'com.utils.DevLog.step'('Send browser console messages')
    WebUI.executeJavaScript("""
        console.log('DevLog smoke test console log from browser');
        console.warn('DevLog smoke test warning from browser');
        console.error('DevLog smoke test simulated console error');
    """, [])

    WebUI.delay(1)

    CustomKeywords.'com.utils.DevLog.step'('Send manual network sample to Network tab')
    CustomKeywords.'com.utils.DevLog.network'('GET', "${targetUrl}/api/devlog-smoke-test", [
        status: 200,
        success: true,
        data: 'Manual network sample from Katalon smoke test'
    ])

    CustomKeywords.'com.utils.DevLog.step'('Validate page title or page body is available')
    String title = ''
    try {
        title = WebUI.getWindowTitle()
    } catch (Exception ignored) {}
    String bodyText = WebUI.executeJavaScript("return document.body ? document.body.innerText.slice(0, 120) : '';", [])
    CustomKeywords.'com.utils.DevLog.step'("Page title: ${title ?: '-'}")
    CustomKeywords.'com.utils.DevLog.step'("Body preview: ${bodyText ?: '-'}")

    CustomKeywords.'com.utils.DevLog.step'('Smoke test passed')
} catch (Exception e) {
    CustomKeywords.'com.utils.DevLog.step'("Smoke test failed: ${e.message}")
    throw e
} finally {
    WebUI.delay(1)
    WebUI.closeBrowser()
}
