package com.schoolconduct.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

public class BackgroundNotificationService extends Service {
    private static final String CHANNEL_ID = "BackgroundNotificationChannel";
    private static final String PULL_CHANNEL_ID = "SchoolConductAlerts_v3";
    private static final int FOREGROUND_NOTIFICATION_ID = 9999;
    
    private Handler handler;
    private Runnable runnable;
    private final int INTERVAL = 5000; // Check every 5 seconds
    
    @Override
    public void onCreate() {
        super.onCreate();
        FileLogger.init(this);
        FileLogger.log("Service onCreate initiated");
        handler = new Handler(Looper.getMainLooper());
        
        createNotificationChannels();
        
        // Start Foreground Service immediately to comply with Android regulations
        Notification notification = createForegroundNotification();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(FOREGROUND_NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(FOREGROUND_NOTIFICATION_ID, notification);
            }
            FileLogger.log("startForeground successful");
        } catch (Exception e) {
            FileLogger.log("startForeground failed", e);
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Foreground Channel
            NotificationChannel foregroundChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Background Sync Status",
                    NotificationManager.IMPORTANCE_LOW
            );
            foregroundChannel.setDescription("Shows background sync status for notifications");
            
            // Pop-up Channel for real alerts
            NotificationChannel alertChannel = new NotificationChannel(
                    PULL_CHANNEL_ID,
                    "School conduct Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription("Popup notifications for attendance, assignments, exams, and results");
            alertChannel.enableLights(true);
            alertChannel.enableVibration(true);
            alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(foregroundChannel);
                manager.createNotificationChannel(alertChannel);
            }
        }
    }

    private Notification createForegroundNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("School Conduct Notifications Active")
                .setContentText("Checking for updates in background...")
                .setSmallIcon(android.R.drawable.ic_popup_sync)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        FileLogger.log("Service onStartCommand called");
        if (runnable == null) {
            runnable = new Runnable() {
                @Override
                public void run() {
                    checkForNewNotifications();
                    handler.postDelayed(this, INTERVAL);
                }
            };
            handler.post(runnable);
        }
        return START_STICKY;
    }

    private void checkForNewNotifications() {
        FileLogger.log("checkForNewNotifications triggered");
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    SharedPreferences prefs = getSharedPreferences("NotificationPrefs", MODE_PRIVATE);
                    String token = prefs.getString("token", "");
                    String apiUrl = prefs.getString("apiUrl", "");
                    boolean serviceEnabled = prefs.getBoolean("serviceEnabled", true);

                    FileLogger.log("Checking notifications. Enabled: " + serviceEnabled + ", Token length: " + token.length() + ", API URL: " + apiUrl);

                    if (!serviceEnabled || token.isEmpty() || apiUrl.isEmpty()) {
                        FileLogger.log("Stopping service. Settings missing or disabled.");
                        stopSelf();
                        return;
                    }

                    // Build endpoint URL
                    String cleanUrl = apiUrl;
                    if (!cleanUrl.endsWith("/")) {
                        cleanUrl += "/";
                    }
                    URL url = new URL(cleanUrl + "communication/my/");
                    FileLogger.log("Polling URL: " + url.toString());
                    
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("Authorization", "Bearer " + token);
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(10000);

                    int responseCode = conn.getResponseCode();
                    FileLogger.log("HTTP response code: " + responseCode);
                    
                    if (responseCode == HttpURLConnection.HTTP_OK) {
                        BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        String inputLine;
                        StringBuilder response = new StringBuilder();
                        while ((inputLine = in.readLine()) != null) {
                            response.append(inputLine);
                        }
                        in.close();

                        JSONArray jsonArray = new JSONArray(response.toString());
                        FileLogger.log("Fetched " + jsonArray.length() + " notifications from server.");
                        
                        // Retrieve already notified ids to avoid duplicate alerts
                        Set<String> notifiedIds = prefs.getStringSet("notified_ids", new HashSet<String>());
                        Set<String> newNotifiedIds = new HashSet<>(notifiedIds);
                        boolean updated = false;

                        for (int i = 0; i < jsonArray.length(); i++) {
                            JSONObject obj = jsonArray.getJSONObject(i);
                            int id = obj.getInt("id");
                            String strId = String.valueOf(id);
                            
                            // If this notification is unread and has not been notified yet
                            boolean isRead = obj.getBoolean("is_read");
                            FileLogger.log("Checking item ID: " + strId + ", title: " + obj.optString("title") + ", is_read: " + isRead);
                            
                            if (!isRead && !notifiedIds.contains(strId)) {
                                String title = obj.optString("title", "New Notification");
                                String message = obj.optString("message", "You have a new update.");
                                
                                FileLogger.log("Firing alert notification. ID: " + strId + ", Title: " + title);
                                triggerAlertNotification(id, title, message);
                                
                                newNotifiedIds.add(strId);
                                updated = true;
                            }
                        }

                        if (updated) {
                            prefs.edit().putStringSet("notified_ids", newNotifiedIds).apply();
                            FileLogger.log("Saved new notified IDs to SharedPreferences");
                        }
                    } else {
                        FileLogger.log("HTTP Error returned from server: " + responseCode);
                    }
                } catch (Exception e) {
                    FileLogger.log("Exception occurred in checking thread", e);
                }
            }
        }).start();
    }

    private void triggerAlertNotification(int notificationId, String title, String message) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.putExtra("notification_id", notificationId);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, notificationId, intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, PULL_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setDefaults(Notification.DEFAULT_ALL);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(notificationId, builder.build());
        }
    }

    @Override
    public void onDestroy() {
        if (handler != null && runnable != null) {
            handler.removeCallbacks(runnable);
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
