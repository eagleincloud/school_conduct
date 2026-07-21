package com.schoolconduct.app;

import android.content.Context;
import android.os.Environment;
import java.io.File;
import java.io.FileWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class FileLogger {
    private static Context appContext;

    public static void init(Context context) {
        if (context != null) {
            appContext = context.getApplicationContext();
        }
    }

    public static void log(String message) {
        try {
            File logDir = null;
            if (appContext != null) {
                logDir = appContext.getExternalFilesDir(null);
            }
            
            if (logDir == null) {
                logDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            }
            
            if (!logDir.exists()) {
                logDir.mkdirs();
            }
            File logFile = new File(logDir, "schoolconduct_log.txt");
            
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
            String timestamp = sdf.format(new Date());
            
            FileWriter writer = new FileWriter(logFile, true);
            writer.write("[" + timestamp + "] " + message + "\n");
            writer.close();
            
            // Also print to Android system log
            android.util.Log.d("SchoolConductLog", message);
        } catch (Exception e) {
            android.util.Log.e("SchoolConductLog", "Failed to write log to file", e);
        }
    }
    
    public static void log(String message, Throwable t) {
        log(message + " | Error: " + t.getMessage());
        java.io.StringWriter sw = new java.io.StringWriter();
        java.io.PrintWriter pw = new java.io.PrintWriter(sw);
        t.printStackTrace(pw);
        log(sw.toString());
    }
}
