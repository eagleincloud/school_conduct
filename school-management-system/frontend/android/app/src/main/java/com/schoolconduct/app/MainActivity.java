package com.schoolconduct.app;

import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        FileLogger.init(this);
        FileLogger.log("MainActivity onCreate started");
        registerPlugin(BackgroundNotificationPlugin.class);
        super.onCreate(savedInstanceState);
        requestAppPermissions();
    }

    private void requestAppPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            java.util.List<String> permissions = new java.util.ArrayList<>();
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                permissions.add(android.Manifest.permission.POST_NOTIFICATIONS);
                permissions.add(android.Manifest.permission.READ_MEDIA_IMAGES);
                permissions.add(android.Manifest.permission.READ_MEDIA_VIDEO);
            } else {
                permissions.add(android.Manifest.permission.READ_EXTERNAL_STORAGE);
                permissions.add(android.Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
            permissions.add(android.Manifest.permission.CAMERA);
            permissions.add(android.Manifest.permission.CALL_PHONE);
            permissions.add(android.Manifest.permission.READ_PHONE_STATE);

            java.util.List<String> missing = new java.util.ArrayList<>();
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
