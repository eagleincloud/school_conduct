using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;

namespace SBXPCDLLSampleCSharp
{
    static class BiometricBridgeConsole
    {
        private static readonly object ConsoleLock = new object();
        private static readonly string ErrorLogPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "biometric_bridge_errors.log");

        class BridgeSettings
        {
            public string DeviceName = "Main Gate";
            public string DeviceIp = "192.168.0.150";
            public int DevicePort = 4370;
            public int DevicePassword = 0;
            public int MachineNumber = 1;
            public string SchoolId = "DEFAULT";
            public string ServerUrl = "http://13.233.140.195/api/attendance/biometric-punch/";
            public string DeviceSecretKey = "y0ur_Sup3r_S3cr3t_B1om3tr1c_K3y_987";
        }

        sealed class WorkerProcessInfo
        {
            public Process Process;
            public string ConfigPath;
            public BridgeSettings Settings;
            public string LogPath;
            public long LastLogPosition;
        }

        public static void Run(string[] args)
        {
            List<string> configPaths = GetConfigPaths(args);
            if (configPaths.Count > 1)
            {
                RunManager(configPaths);
                return;
            }

            BridgeSettings settings = LoadSettingsFromPath(configPaths.Count == 1 ? configPaths[0] : null);
            RunWorker(settings);
        }

        private static void RunManager(List<string> configPaths)
        {
            Console.Title = "Z500V2 Biometric Bridge Manager";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("======================================================================");
            Console.WriteLine("     Z500V2 NATIVE C# BIOMETRIC BRIDGE MANAGER");
            Console.WriteLine("======================================================================");
            Console.ResetColor();

            string exePath = Process.GetCurrentProcess().MainModule.FileName;
            var workers = new List<WorkerProcessInfo>();

            foreach (string configPath in configPaths)
            {
                BridgeSettings settings = LoadSettingsFromPath(configPath);
                string workerLogPath = BuildWorkerLogPath(settings);
                Process worker = StartHiddenWorker(exePath, configPath, workerLogPath);
                workers.Add(new WorkerProcessInfo
                {
                    Process = worker,
                    ConfigPath = configPath,
                    Settings = settings,
                    LogPath = workerLogPath,
                    LastLogPosition = 0
                });

                LogLine("[MANAGER] Started worker PID " + worker.Id + " for "
                    + settings.SchoolId + " | " + settings.DeviceName + " | "
                    + settings.DeviceIp + ":" + settings.DevicePort + " | machine "
                    + settings.MachineNumber);
            }

            Console.WriteLine();
            LogLine("[MANAGER] Hidden worker processes are running. Keep this window open to supervise them.");
            LogLine("[MANAGER] Press Ctrl+C to stop the manager. Hidden workers will continue unless closed separately.");

            while (true)
            {
                foreach (WorkerProcessInfo worker in workers)
                {
                    try
                    {
                        PumpWorkerLog(worker);
                        if (worker.Process.HasExited)
                        {
                            LogLine("[MANAGER] Worker exited for "
                                + worker.Settings.DeviceName + " ("
                                + worker.Settings.DeviceIp + "). Restarting...");
                            worker.Process.Dispose();
                            worker.Process = StartHiddenWorker(exePath, worker.ConfigPath, worker.LogPath);
                            worker.LastLogPosition = 0;
                            LogLine("[MANAGER] Restarted worker PID " + worker.Process.Id + " for "
                                + worker.Settings.DeviceName + " (" + worker.Settings.DeviceIp + ").");
                        }
                    }
                    catch (Exception ex)
                    {
                        WriteError("[MANAGER] Worker supervision error for " + worker.ConfigPath + ": " + ex);
                    }
                }

                Thread.Sleep(TimeSpan.FromSeconds(10));
            }
        }

        private static Process StartHiddenWorker(string exePath, string configPath, string workerLogPath)
        {
            EnsureParentDirectory(workerLogPath);
            var startInfo = new ProcessStartInfo
            {
                FileName = exePath,
                Arguments = "--worker \"" + configPath + "\" --log \"" + workerLogPath + "\"",
                WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory,
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            return Process.Start(startInfo);
        }

        private static void RunWorker(BridgeSettings settings)
        {
            string prefix = "[" + settings.SchoolId + " | " + settings.DeviceName + " | " + settings.DeviceIp + ":" + settings.DevicePort + "]";
            string workerLogPath = GetWorkerLogPath(Environment.GetCommandLineArgs(), settings);

            Console.Title = "Z500V2 Biometric Bridge Worker";
            sbxpc.SBXPCDLL.DotNET();
            sbxpc.SBXPCDLL._DisableTranseiveCallback();

            while (true)
            {
                try
                {
                    StartBridge(settings, prefix, workerLogPath);
                }
                catch (Exception ex)
                {
                    WriteError(prefix + " Bridge crashed: " + ex, workerLogPath);
                    LogLine(prefix + " [RESTARTING] Bridge crashed. Restarting in 10 seconds...", workerLogPath);
                    Thread.Sleep(TimeSpan.FromSeconds(10));
                }
            }
        }

        private static void StartBridge(BridgeSettings settings, string prefix, string workerLogPath)
        {
            LogLine(new string('=', 90), workerLogPath);
            LogLine(prefix + " Connecting to biometric device...", workerLogPath);
            LogLine(new string('=', 90), workerLogPath);

            if (!sbxpc.SBXPCDLL.ConnectTcpip(settings.MachineNumber, settings.DeviceIp, settings.DevicePort, settings.DevicePassword))
            {
                int errorCode;
                sbxpc.SBXPCDLL.GetLastError(settings.MachineNumber, out errorCode);
                throw new InvalidOperationException("Device connection failed: " + util.ErrorPrint(errorCode));
            }

            LogLine(prefix + " [SUCCESS] Connected to biometric machine.", workerLogPath);
            LogLine(prefix + " Listening and polling for new punches. Syncing with: " + settings.ServerUrl, workerLogPath);

            DateTime lastCheckedPunchTime = DateTime.Now;
            DateTime lastHeartbeatAt = DateTime.MinValue;
            var postedPunchKeys = new HashSet<string>();

            try
            {
                while (true)
                {
                    try
                    {
                        foreach (PunchLog punch in ReadPunchLogs(settings, prefix, workerLogPath))
                        {
                            if ((DateTime.Now - lastHeartbeatAt).TotalSeconds >= 8)
                            {
                                PostHeartbeat(settings, prefix, workerLogPath, "online", "Bridge connected and polling.");
                                lastHeartbeatAt = DateTime.Now;
                            }

                            if (punch.Timestamp <= lastCheckedPunchTime)
                            {
                                continue;
                            }

                            string punchKey = punch.RfidCode + "|" + punch.Timestamp.ToString("yyyy-MM-dd HH:mm:ss");
                            if (postedPunchKeys.Contains(punchKey))
                            {
                                continue;
                            }

                            LogLine(prefix + " [PUNCH DETECTED] RFID/User ID: " + punch.RfidCode + " | Time: " + punch.Timestamp, workerLogPath);
                            PostPunch(settings, punch, prefix, workerLogPath);
                            postedPunchKeys.Add(punchKey);

                            if (punch.Timestamp > lastCheckedPunchTime)
                            {
                                lastCheckedPunchTime = punch.Timestamp;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        LogLine(prefix + " [ERROR] Polling error: " + ex.Message, workerLogPath);
                        WriteError(prefix + " Polling error: " + ex, workerLogPath);
                    }

                    Thread.Sleep(TimeSpan.FromSeconds(5));
                }
            }
            finally
            {
                try
                {
                    sbxpc.SBXPCDLL.EnableDevice(settings.MachineNumber, 1);
                    sbxpc.SBXPCDLL.Disconnect(settings.MachineNumber);
                }
                catch
                {
                }

                LogLine(prefix + " [INFO] Connection closed.", workerLogPath);
            }
        }

        private static IEnumerable<PunchLog> ReadPunchLogs(BridgeSettings settings, string prefix, string workerLogPath)
        {
            var punches = new List<PunchLog>();
            int errorCode;

            sbxpc.SBXPCDLL.EnableDevice(settings.MachineNumber, 0);

            try
            {
                if (!sbxpc.SBXPCDLL.ReadGeneralLogData(settings.MachineNumber, 0))
                {
                    sbxpc.SBXPCDLL.GetLastError(settings.MachineNumber, out errorCode);
                    LogLine(prefix + " [WARNING] Could not read general logs: " + util.ErrorPrint(errorCode), workerLogPath);
                    return punches;
                }

                while (true)
                {
                    int terminalMachineNumber;
                    int enrollNumber;
                    int enrollMachineNumber;
                    int verifyMode;
                    int year;
                    int month;
                    int day;
                    int hour;
                    int minute;
                    int second;

                    bool hasLog = sbxpc.SBXPCDLL.GetGeneralLogData(
                        settings.MachineNumber,
                        out terminalMachineNumber,
                        out enrollNumber,
                        out enrollMachineNumber,
                        out verifyMode,
                        out year,
                        out month,
                        out day,
                        out hour,
                        out minute,
                        out second);

                    if (!hasLog)
                    {
                        break;
                    }

                    DateTime timestamp;
                    try
                    {
                        timestamp = new DateTime(year, month, day, hour, minute, second);
                    }
                    catch
                    {
                        continue;
                    }

                    punches.Add(new PunchLog(enrollNumber.ToString(), timestamp));
                }
            }
            finally
            {
                sbxpc.SBXPCDLL.EnableDevice(settings.MachineNumber, 1);
            }

            return punches;
        }

        private static void PostPunch(BridgeSettings settings, PunchLog punch, string prefix, string workerLogPath)
        {
            string json = "{"
                + "\"rfid_code\":\"" + JsonEscape(punch.RfidCode) + "\","
                + "\"school_id\":\"" + JsonEscape(settings.SchoolId) + "\","
                + "\"punch_time\":\"" + punch.Timestamp.ToString("yyyy-MM-dd HH:mm:ss") + "\""
                + "}";

            byte[] body = Encoding.UTF8.GetBytes(json);
            var request = (HttpWebRequest)WebRequest.Create(settings.ServerUrl);
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Headers.Add("X-Device-Token", settings.DeviceSecretKey);
            request.Timeout = 10000;
            request.ContentLength = body.Length;

            using (Stream requestStream = request.GetRequestStream())
            {
                requestStream.Write(body, 0, body.Length);
            }

            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    string responseBody = ReadResponseBody(response);
                    if ((int)response.StatusCode == 201 || (int)response.StatusCode == 200)
                    {
                            LogLine(prefix + "   [SYNCED] Server accepted punch: " + responseBody, workerLogPath);
                        }
                        else
                        {
                            LogLine(prefix + "   [FAILED] Server rejected punch: " + (int)response.StatusCode + " - " + responseBody, workerLogPath);
                            WriteError(prefix + " Server rejected punch for RFID " + punch.RfidCode + ": " + (int)response.StatusCode + " - " + responseBody, workerLogPath);
                        }
                }
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response == null)
                {
                    throw;
                }

                using (response)
                {
                    string responseBody = ReadResponseBody(response);
                    LogLine(prefix + "   [FAILED] Server rejected punch: " + (int)response.StatusCode + " - " + responseBody, workerLogPath);
                    WriteError(prefix + " Server rejected punch for RFID " + punch.RfidCode + ": " + (int)response.StatusCode + " - " + responseBody, workerLogPath);
                }
            }
        }

        private static void PostHeartbeat(BridgeSettings settings, string prefix, string workerLogPath, string statusValue, string message)
        {
            string heartbeatUrl = settings.ServerUrl.Replace("/biometric-punch/", "/biometric-heartbeat/");
            string json = "{"
                + "\"school_id\":\"" + JsonEscape(settings.SchoolId) + "\","
                + "\"status\":\"" + JsonEscape(statusValue) + "\","
                + "\"message\":\"" + JsonEscape(message) + "\""
                + "}";

            byte[] body = Encoding.UTF8.GetBytes(json);
            var request = (HttpWebRequest)WebRequest.Create(heartbeatUrl);
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Headers.Add("X-Device-Token", settings.DeviceSecretKey);
            request.Timeout = 10000;
            request.ContentLength = body.Length;

            using (Stream requestStream = request.GetRequestStream())
            {
                requestStream.Write(body, 0, body.Length);
            }

            try
            {
                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    if ((int)response.StatusCode != 200)
                    {
                        string responseBody = ReadResponseBody(response);
                        LogLine(prefix + "   [HEARTBEAT FAILED] " + (int)response.StatusCode + " - " + responseBody, workerLogPath);
                    }
                }
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null)
                {
                    using (response)
                    {
                        string responseBody = ReadResponseBody(response);
                        LogLine(prefix + "   [HEARTBEAT FAILED] " + (int)response.StatusCode + " - " + responseBody, workerLogPath);
                    }
                    return;
                }

                LogLine(prefix + "   [HEARTBEAT ERROR] " + ex.Message, workerLogPath);
            }
        }

        private static List<string> GetConfigPaths(string[] args)
        {
            var paths = new List<string>();
            if (args == null || args.Length == 0)
            {
                return paths;
            }

            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i];
                if (string.Equals(arg, "--worker", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                if (string.Equals(arg, "--log", StringComparison.OrdinalIgnoreCase))
                {
                    i++;
                    continue;
                }

                if (string.IsNullOrWhiteSpace(arg))
                {
                    continue;
                }

                paths.Add(ResolveConfigPath(arg));
            }

            return paths;
        }

        private static BridgeSettings LoadSettingsFromPath(string configPath)
        {
            BridgeSettings settings = new BridgeSettings();
            configPath = ResolveConfigPath(configPath);

            if (File.Exists(configPath))
            {
                try
                {
                    string content = File.ReadAllText(configPath);
                    settings.DeviceName = GetJsonValue(content, "device_name", settings.DeviceName);
                    settings.DeviceIp = GetJsonValue(content, "device_ip", settings.DeviceIp);
                    settings.DevicePort = int.Parse(GetJsonValue(content, "device_port", settings.DevicePort.ToString()));
                    settings.DevicePassword = int.Parse(GetJsonValue(content, "device_password", settings.DevicePassword.ToString()));
                    settings.MachineNumber = int.Parse(GetJsonValue(content, "machine_number", settings.MachineNumber.ToString()));
                    settings.SchoolId = GetJsonValue(content, "school_id", settings.SchoolId);
                    settings.ServerUrl = GetJsonValue(content, "server_url", settings.ServerUrl);
                    settings.DeviceSecretKey = GetJsonValue(content, "device_secret_key", settings.DeviceSecretKey);
                }
                catch (Exception ex)
                {
                    LogLine("[WARNING] Failed to parse config file: " + configPath + ", using defaults. Error: " + ex.Message);
                }
            }
            else
            {
                LogLine("[INFO] Config file not found: " + configPath + ", generating default config...");
                try
                {
                    string defaultJson = "{\n" +
                        "  \"device_name\": \"Main Gate\",\n" +
                        "  \"device_ip\": \"192.168.0.150\",\n" +
                        "  \"device_port\": 4370,\n" +
                        "  \"device_password\": 0,\n" +
                        "  \"machine_number\": 1,\n" +
                        "  \"school_id\": \"DEFAULT\",\n" +
                        "  \"server_url\": \"http://127.0.0.1:8000/api/attendance/biometric-punch/\",\n" +
                        "  \"device_secret_key\": \"y0ur_Sup3r_S3cr3t_B1om3tr1c_K3y_987\"\n" +
                        "}";
                    File.WriteAllText(configPath, defaultJson);
                }
                catch
                {
                }
            }

            return settings;
        }

        private static string ResolveConfigPath(string configArg)
        {
            string defaultPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bridge_config.json");
            if (string.IsNullOrWhiteSpace(configArg))
            {
                return defaultPath;
            }
            if (Path.IsPathRooted(configArg))
            {
                return configArg;
            }
            return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, configArg);
        }

        private static string GetJsonValue(string json, string key, string defaultValue)
        {
            string searchStr = "\"" + key + "\"";
            int index = json.IndexOf(searchStr);
            if (index == -1) return defaultValue;

            int colonIndex = json.IndexOf(":", index);
            if (colonIndex == -1) return defaultValue;

            int valueStart = colonIndex + 1;
            while (valueStart < json.Length && (char.IsWhiteSpace(json[valueStart]) || json[valueStart] == '"'))
            {
                valueStart++;
            }

            int valueEnd = valueStart;
            while (valueEnd < json.Length && json[valueEnd] != ',' && json[valueEnd] != '}' && json[valueEnd] != '\n' && json[valueEnd] != '\r' && json[valueEnd] != '"')
            {
                valueEnd++;
            }

            if (valueEnd > valueStart)
            {
                return json.Substring(valueStart, valueEnd - valueStart).Trim();
            }
            return defaultValue;
        }

        private static string ReadResponseBody(HttpWebResponse response)
        {
            Stream responseStream = response.GetResponseStream();
            if (responseStream == null)
            {
                return string.Empty;
            }

            using (responseStream)
            using (var reader = new StreamReader(responseStream))
            {
                return reader.ReadToEnd();
            }
        }

        private static string JsonEscape(string value)
        {
            return (value ?? string.Empty)
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n");
        }

        private static void LogLine(string message, string workerLogPath = null)
        {
            lock (ConsoleLock)
            {
                Console.WriteLine(message);
            }
            if (!string.IsNullOrWhiteSpace(workerLogPath))
            {
                try
                {
                    EnsureParentDirectory(workerLogPath);
                    File.AppendAllText(workerLogPath, message + Environment.NewLine);
                }
                catch
                {
                }
            }
        }

        private static void WriteError(string message, string workerLogPath = null)
        {
            try
            {
                File.AppendAllText(ErrorLogPath, "[" + DateTime.Now + "] " + message + Environment.NewLine);
            }
            catch
            {
            }
            if (!string.IsNullOrWhiteSpace(workerLogPath))
            {
                try
                {
                    EnsureParentDirectory(workerLogPath);
                    File.AppendAllText(workerLogPath, "[ERROR] " + message + Environment.NewLine);
                }
                catch
                {
                }
            }
        }

        private static void PumpWorkerLog(WorkerProcessInfo worker)
        {
            if (string.IsNullOrWhiteSpace(worker.LogPath) || !File.Exists(worker.LogPath))
            {
                return;
            }

            using (var stream = new FileStream(worker.LogPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            {
                if (worker.LastLogPosition > stream.Length)
                {
                    worker.LastLogPosition = 0;
                }
                stream.Seek(worker.LastLogPosition, SeekOrigin.Begin);
                using (var reader = new StreamReader(stream))
                {
                    string content = reader.ReadToEnd();
                    worker.LastLogPosition = stream.Position;
                    if (string.IsNullOrWhiteSpace(content))
                    {
                        return;
                    }
                    string[] lines = content.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
                    foreach (string line in lines)
                    {
                        lock (ConsoleLock)
                        {
                            Console.WriteLine(line);
                        }
                    }
                }
            }
        }

        private static string GetWorkerLogPath(string[] args, BridgeSettings settings)
        {
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (string.Equals(args[i], "--log", StringComparison.OrdinalIgnoreCase))
                {
                    return ResolveConfigPath(args[i + 1]);
                }
            }
            return BuildWorkerLogPath(settings);
        }

        private static string BuildWorkerLogPath(BridgeSettings settings)
        {
            string safeName = (settings.SchoolId + "_" + settings.DeviceName + "_" + settings.DeviceIp)
                .Replace(" ", "_")
                .Replace(":", "_")
                .Replace(".", "_");
            return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "worker_logs", safeName + ".log");
        }

        private static void EnsureParentDirectory(string path)
        {
            string parent = Path.GetDirectoryName(path);
            if (!string.IsNullOrWhiteSpace(parent))
            {
                Directory.CreateDirectory(parent);
            }
        }

        private sealed class PunchLog
        {
            public PunchLog(string rfidCode, DateTime timestamp)
            {
                RfidCode = rfidCode;
                Timestamp = timestamp;
            }

            public string RfidCode { get; private set; }
            public DateTime Timestamp { get; private set; }
        }
    }
}
