package com.schoolconduct.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundNotification")
public class BackgroundNotificationPlugin extends Plugin {

    @PluginMethod
    public void startService(PluginCall call) {
        String token = call.getString("token");
        String apiUrl = call.getString("apiUrl");
        
        FileLogger.log("Plugin startService called | Token length: " + (token == null ? "null" : token.length()) + " | URL: " + apiUrl);
        
        if (token == null || apiUrl == null) {
            FileLogger.log("Plugin startService rejected: Token or API URL missing");
            call.reject("Token or API URL is missing");
            return;
        }

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences("NotificationPrefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("token", token);
        editor.putString("apiUrl", apiUrl);
        editor.putBoolean("serviceEnabled", true);
        editor.apply();

        Intent intent = new Intent(context, BackgroundNotificationService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            FileLogger.log("Plugin startForegroundService/startService intent triggered successfully");
        } catch (Exception e) {
            FileLogger.log("Plugin failed to start background service", e);
        }

        JSObject ret = new JSObject();
        ret.put("status", "started");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences("NotificationPrefs", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putBoolean("serviceEnabled", false);
        editor.apply();

        Intent intent = new Intent(context, BackgroundNotificationService.class);
        context.stopService(intent);

        JSObject ret = new JSObject();
        ret.put("status", "stopped");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        java.util.List<String> permissions = new java.util.ArrayList<>();
        
        // 1. Notifications (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(android.Manifest.permission.POST_NOTIFICATIONS);
        }
        
        // 2. Camera
        permissions.add(android.Manifest.permission.CAMERA);
        
        // 3. Media
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(android.Manifest.permission.READ_MEDIA_IMAGES);
            permissions.add(android.Manifest.permission.READ_MEDIA_VIDEO);
        } else {
            permissions.add(android.Manifest.permission.READ_EXTERNAL_STORAGE);
            permissions.add(android.Manifest.permission.WRITE_EXTERNAL_STORAGE);
        }
        
        // 4. Phone
        permissions.add(android.Manifest.permission.CALL_PHONE);
        permissions.add(android.Manifest.permission.READ_PHONE_STATE);

        // Filter permissions that are not already granted
        java.util.List<String> listToRequest = new java.util.ArrayList<>();
        for (String perm : permissions) {
            try {
                if (getContext().checkSelfPermission(perm) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    listToRequest.add(perm);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        if (!listToRequest.isEmpty()) {
            try {
                getActivity().requestPermissions(listToRequest.toArray(new String[0]), 102);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        JSObject ret = new JSObject();
        ret.put("status", "requested");
        call.resolve(ret);
    }
}
