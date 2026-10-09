package com.eagleincloud.schoolconduct;

import android.net.Uri;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * Custom WebChromeClient that delegates visual media (photo/video) selection
 * to the modern Android Photo Picker (PickVisualMedia / PickMultipleVisualMedia),
 * while falling back to the standard file/document picker for generic files.
 */
public class CustomBridgeWebChromeClient extends BridgeWebChromeClient {
    private final MainActivity activity;

    public CustomBridgeWebChromeClient(Bridge bridge, MainActivity activity) {
        super(bridge);
        this.activity = activity;
    }

    @Override
    public boolean onShowFileChooser(
        WebView webView,
        ValueCallback<Uri[]> filePathCallback,
        FileChooserParams fileChooserParams
    ) {
        if (activity != null && activity.handleFileChooser(webView, filePathCallback, fileChooserParams)) {
            return true;
        }
        return super.onShowFileChooser(webView, filePathCallback, fileChooserParams);
    }
}
