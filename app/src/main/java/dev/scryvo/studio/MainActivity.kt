package dev.scryvo.studio

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayOutputStream

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var pendingWebPermission: PermissionRequest? = null
    private var pendingExportBytes: ByteArray? = null
    private var pendingExportName: String = "SCRYVO.scryvo"

    companion object {
        private const val REQUEST_FILE = 4101
        private const val REQUEST_EXPORT = 4102
        private const val REQUEST_MIC = 4103
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            )

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this)
        webView.setBackgroundColor(android.graphics.Color.rgb(17, 25, 35))
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.setSupportZoom(false)
        webView.settings.builtInZoomControls = false
        webView.addJavascriptInterface(FileExportBridge(), "ScryvoBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest) =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean {
                // The studio is self-contained. Do not let page content navigate to external sites.
                return request.url.host != "appassets.androidplatform.net"
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                webView.evaluateJavascript("window.__SCRYVO_NATIVE__ = true;", null)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.fileChooserCallback?.onReceiveValue(null)
                this@MainActivity.fileChooserCallback = filePathCallback
                val requestedTypes = fileChooserParams?.acceptTypes
                    ?.flatMap { it.split(',') }
                    ?.map { it.trim() }
                    // Android's picker expects MIME types, not filename extensions such as .scryvo.
                    ?.filter { it.matches(Regex("[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+")) }
                    ?.distinct()
                    .orEmpty()
                val pickerTypes = if (fileChooserParams?.acceptTypes?.any { it.contains(".scryvo", true) } == true) {
                    (requestedTypes + "application/octet-stream").distinct()
                } else requestedTypes
                val family = when {
                    pickerTypes.isNotEmpty() && pickerTypes.all { it.startsWith("image/") } -> "image/*"
                    pickerTypes.isNotEmpty() && pickerTypes.all { it.startsWith("audio/") } -> "audio/*"
                    pickerTypes.isNotEmpty() && pickerTypes.all { it == "application/json" } -> "application/json"
                    else -> "*/*"
                }
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = family
                    if (pickerTypes.isNotEmpty()) putExtra(Intent.EXTRA_MIME_TYPES, pickerTypes.toTypedArray())
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                return try {
                    startActivityForResult(intent, REQUEST_FILE)
                    true
                } catch (_: Exception) {
                    this@MainActivity.fileChooserCallback = null
                    false
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val wantsAudio = request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                    if (!wantsAudio) {
                        request.deny()
                    } else if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                    } else {
                        pendingWebPermission = request
                        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
                    }
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingWebPermission == request) pendingWebPermission = null
            }
        }

        webView.overScrollMode = View.OVER_SCROLL_NEVER
        setContentView(webView)
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
    }

    inner class FileExportBridge {
        @JavascriptInterface
        fun exportFile(fileName: String, base64Payload: String) {
            runOnUiThread {
                try {
                    pendingExportName = fileName.ifBlank { "SCRYVO.scryvo" }
                    val clean = base64Payload.substringAfter(",", base64Payload)
                    pendingExportBytes = Base64.decode(clean, Base64.DEFAULT)
                    val mime = if (pendingExportName.endsWith(".scryvo", true)) "application/octet-stream" else "application/json"
                    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = mime
                        putExtra(Intent.EXTRA_TITLE, pendingExportName)
                    }
                    startActivityForResult(intent, REQUEST_EXPORT)
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Could not export this file", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    @Deprecated("Legacy callback required for WebView file chooser compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            REQUEST_FILE -> {
                val result = if (resultCode == RESULT_OK && data?.data != null) arrayOf(data.data!!) else null
                fileChooserCallback?.onReceiveValue(result)
                fileChooserCallback = null
            }
            REQUEST_EXPORT -> {
                val bytesToWrite = pendingExportBytes
                if (resultCode == RESULT_OK && data?.data != null && bytesToWrite != null) {
                    try {
                        contentResolver.openOutputStream(data.data!!)?.use { it.write(bytesToWrite) }
                        Toast.makeText(this, "Exported successfully", Toast.LENGTH_SHORT).show()
                    } catch (_: Exception) {
                        Toast.makeText(this, "Export failed", Toast.LENGTH_SHORT).show()
                    }
                }
                pendingExportBytes = null
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_MIC) {
            val request = pendingWebPermission
            pendingWebPermission = null
            if (request != null) {
                if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                } else {
                    request.deny()
                    Toast.makeText(this, "Microphone permission was not granted", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onBackPressed() {
        webView.evaluateJavascript("window.scryvoHandleBack && window.scryvoHandleBack()", null)
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.removeJavascriptInterface("ScryvoBridge")
            webView.destroy()
        }
        super.onDestroy()
    }
}
