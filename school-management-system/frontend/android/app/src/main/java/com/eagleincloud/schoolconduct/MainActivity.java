package com.eagleincloud.schoolconduct;

import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainActivity extends BridgeActivity {

    private ActivityResultLauncher<PickVisualMediaRequest> pickMediaLauncher;
    private ActivityResultLauncher<PickVisualMediaRequest> pickMultipleMediaLauncher;
    private ValueCallback<Uri[]> currentFilePathCallback;

    private enum VisualMediaType {
        IMAGE_ONLY,
        VIDEO_ONLY,
        IMAGE_AND_VIDEO
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        FileLogger.init(this);
        FileLogger.log("MainActivity onCreate started");
        registerPlugin(BackgroundNotificationPlugin.class);
        initPhotoPickerLaunchers();
        super.onCreate(savedInstanceState);
        setupCustomWebChromeClient();
        requestAppPermissions();
    }

    private void initPhotoPickerLaunchers() {
        pickMediaLauncher = registerForActivityResult(
            new ActivityResultContracts.PickVisualMedia(),
            uri -> {
                if (currentFilePathCallback != null) {
                    Uri[] result = (uri != null) ? new Uri[] { uri } : null;
                    currentFilePathCallback.onReceiveValue(result);
                    currentFilePathCallback = null;
                }
            }
        );

        pickMultipleMediaLauncher = registerForActivityResult(
            new ActivityResultContracts.PickMultipleVisualMedia(),
            uris -> {
                if (currentFilePathCallback != null) {
                    Uri[] result = null;
                    if (uris != null && !uris.isEmpty()) {
                        result = uris.toArray(new Uri[0]);
                    }
                    currentFilePathCallback.onReceiveValue(result);
                    currentFilePathCallback = null;
                }
            }
        );
    }

    private void setupCustomWebChromeClient() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().setWebChromeClient(
                    new CustomBridgeWebChromeClient(getBridge(), this)
                );
                FileLogger.log("CustomBridgeWebChromeClient installed successfully");
            }
        } catch (Exception e) {
            FileLogger.log("Failed to setup CustomBridgeWebChromeClient", e);
        }
    }

    public boolean handleFileChooser(
        WebView webView,
        ValueCallback<Uri[]> filePathCallback,
        WebChromeClient.FileChooserParams fileChooserParams
    ) {
        if (fileChooserParams == null || filePathCallback == null) {
            return false;
        }

        // Camera capture (e.g. <input type="file" capture>) is handled by default camera handler
        if (fileChooserParams.isCaptureEnabled()) {
            return false;
        }

        VisualMediaType mediaType = determineVisualMediaType(fileChooserParams.getAcceptTypes());
        if (mediaType == null) {
            // Non-media or mixed document types (PDF, Word, CSV, etc.) fall back to standard file picker
            return false;
        }

        ActivityResultContracts.PickVisualMedia.VisualMediaType pickType;
        if (mediaType == VisualMediaType.IMAGE_ONLY) {
            pickType = ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE;
        } else if (mediaType == VisualMediaType.VIDEO_ONLY) {
            pickType = ActivityResultContracts.PickVisualMedia.VideoOnly.INSTANCE;
        } else {
            pickType = ActivityResultContracts.PickVisualMedia.ImageAndVideo.INSTANCE;
        }

        PickVisualMediaRequest request = new PickVisualMediaRequest.Builder()
            .setMediaType(pickType)
            .build();

        try {
            if (currentFilePathCallback != null) {
                try {
                    currentFilePathCallback.onReceiveValue(null);
                } catch (Exception ignored) {}
                currentFilePathCallback = null;
            }
            currentFilePathCallback = filePathCallback;

            if (fileChooserParams.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                pickMultipleMediaLauncher.launch(request);
            } else {
                pickMediaLauncher.launch(request);
            }
            FileLogger.log("Launched Android Photo Picker for " + mediaType);
            return true;
        } catch (Exception e) {
            FileLogger.log("Failed to launch Photo Picker, falling back to default", e);
            if (currentFilePathCallback == filePathCallback) {
                currentFilePathCallback = null;
            }
            return false;
        }
    }

    private VisualMediaType determineVisualMediaType(String[] acceptTypes) {
        if (acceptTypes == null || acceptTypes.length == 0) {
            return null;
        }

        boolean hasImage = false;
        boolean hasVideo = false;
        boolean hasOther = false;

        for (String rawType : acceptTypes) {
            if (rawType == null) continue;
            String trimmed = rawType.trim();
            if (trimmed.isEmpty()) continue;

            String[] parts = trimmed.split(",");
            for (String part : parts) {
                String type = part.trim().toLowerCase(Locale.US);
                if (type.isEmpty()) continue;

                if (type.equals("*/*") || type.equals("*")) {
                    hasOther = true;
                } else if (type.startsWith("image/") || isImageExtension(type)) {
                    hasImage = true;
                } else if (type.startsWith("video/") || isVideoExtension(type)) {
                    hasVideo = true;
                } else {
                    hasOther = true;
                }
            }
        }

        // If generic or document formats (PDF, DOCX, CSV) are accepted, don't force Photo Picker
        if (hasOther) {
            return null;
        }

        if (hasImage && hasVideo) {
            return VisualMediaType.IMAGE_AND_VIDEO;
        } else if (hasImage) {
            return VisualMediaType.IMAGE_ONLY;
        } else if (hasVideo) {
            return VisualMediaType.VIDEO_ONLY;
        }

        return null;
    }

    private static boolean isImageExtension(String type) {
        return type.endsWith(".jpg") || type.endsWith(".jpeg") || type.endsWith(".png") ||
               type.endsWith(".gif") || type.endsWith(".webp") || type.endsWith(".bmp") ||
               type.endsWith(".heic") || type.endsWith(".svg");
    }

    private static boolean isVideoExtension(String type) {
        return type.endsWith(".mp4") || type.endsWith(".mkv") || type.endsWith(".mov") ||
               type.endsWith(".3gp") || type.endsWith(".avi") || type.endsWith(".webm") ||
               type.endsWith(".flv");
    }

    private void requestAppPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> permissions = new ArrayList<>();
            
            // Only request runtime permissions genuinely needed by core features
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                permissions.add(android.Manifest.permission.POST_NOTIFICATIONS);
            }
            permissions.add(android.Manifest.permission.CAMERA);
            permissions.add(android.Manifest.permission.CALL_PHONE);
            permissions.add(android.Manifest.permission.READ_PHONE_STATE);

            List<String> missing = new ArrayList<>();
            for (String perm : permissions) {
                if (checkSelfPermission(perm) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    missing.add(perm);
                }
            }

            if (!missing.isEmpty()) {
                requestPermissions(missing.toArray(new String[0]), 102);
            }
        }
    }
}
