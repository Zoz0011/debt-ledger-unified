package com.beiny.ledger;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
    }

    @Override
    public void onBackPressed() {
        WebView webView = getBridge().getWebView();
        webView.evaluateJavascript("window.__beinyGoHome && window.__beinyGoHome()", null);
    }
}
