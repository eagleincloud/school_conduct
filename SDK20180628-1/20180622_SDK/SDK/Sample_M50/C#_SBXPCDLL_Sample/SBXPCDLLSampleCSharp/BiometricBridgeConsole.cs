using System;
using System.Text;
using System.Threading;

namespace SBXPCDLLSampleCSharp
{
    class BiometricBridgeConsole
    {
        private static string DEVICE_IP = "192.168.0.150";
        private static int DEVICE_PORT = 4370;
        private static int DEVICE_PASSWORD = 0;
        private static int MACHINE_NUMBER = 1;
        private static string SCHOOL_ID = "DEFAULT";
        private static string SERVER_URL = "http://127.0.0.1:8000/api/attendance/biometric-punch/";
        private static string DEVICE_SECRET_KEY = "y0ur_Sup3r_S3cr3t_B1om3tr1c_K3y_987";

        class BridgeSettings
        {
            public string DeviceIp = "192.168.0.150";
            public int DevicePort = 4370;
            public int DevicePassword = 0;
            public int MachineNumber = 1;
            public string SchoolId = "DEFAULT";
            public string ServerUrl = "http://127.0.0.1:8000/api/attendance/biometric-punch/";
            public string DeviceSecretKey = "y0ur_Sup3r_S3cr3t_B1om3tr1c_K3y_987";
        }

        static BridgeSettings LoadSettings(string[] args)
        {
            BridgeSettings settings = new BridgeSettings();
            string configPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "bridge_config.json");
            
            if (args != null && args.Length > 0 && !string.IsNullOrEmpty(args[0]))
            {
                string argPath = args[0];
                if (System.IO.Path.IsPathRooted(argPath))
                {
                    configPath = argPath;
                }
                else
                {
                    configPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, argPath);
                }
            }
            
            if (System.IO.File.Exists(configPath))
            {
                try
                {
                    string content = System.IO.File.ReadAllText(configPath);
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
                    Console.WriteLine("[WARNING] Failed to parse config file: " + configPath + ", using defaults. Error: " + ex.Message);
                }
            }
            else
            {
                Console.WriteLine("[INFO] Config file not found: " + configPath + ", generating default config...");
                try
                {
                    string defaultJson = "{\n" +
                        "  \"device_ip\": \"192.168.0.150\",\n" +
                        "  \"device_port\": 4370,\n" +
                        "  \"device_password\": 0,\n" +
                        "  \"machine_number\": 1,\n" +
                        "  \"school_id\": \"DEFAULT\",\n" +
                        "  \"server_url\": \"http://127.0.0.1:8000/api/attendance/biometric-punch/\",\n" +
                        "  \"device_secret_key\": \"y0ur_Sup3r_S3cr3t_B1om3tr1c_K3y_987\"\n" +
                        "}";
                    System.IO.File.WriteAllText(configPath, defaultJson);
                }
                catch { }
            }
            return settings;
        }

        static string GetJsonValue(string json, string key, string defaultValue)
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
        // =========================================================================

        public static void Run(string[] args)
        {
            BridgeSettings settings = LoadSettings(args);
            DEVICE_IP = settings.DeviceIp;
            DEVICE_PORT = settings.DevicePort;
            DEVICE_PASSWORD = settings.DevicePassword;
            MACHINE_NUMBER = settings.MachineNumber;
            SCHOOL_ID = settings.SchoolId;
            SERVER_URL = settings.ServerUrl;
            DEVICE_SECRET_KEY = settings.DeviceSecretKey;

            Console.Title = "Z500V2 Biometric Bridge Console";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("======================================================================");
            Console.WriteLine("     Z500V2 NATIVE C# BIOMETRIC BRIDGE SERVICE");
            Console.WriteLine("     School ID: [" + SCHOOL_ID + "]");
            Console.WriteLine("======================================================================");
            Console.ResetColor();

            // Initialize .NET DLL configuration
            sbxpc.SBXPCDLL.DotNET();
            sbxpc.SBXPCDLL._DisableTranseiveCallback();

            while (true)
            {
                Console.WriteLine(string.Format("\n[INFO] Connecting to Biometric machine {0}:{1}...", DEVICE_IP, DEVICE_PORT));
                
                // Connect to Z500V2 natively over TCP/IP using the official DLL SDK
                bool connected = sbxpc.SBXPCDLL.ConnectTcpip(MACHINE_NUMBER, DEVICE_IP, DEVICE_PORT, DEVICE_PASSWORD);

                if (connected)
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("[SUCCESS] Connected to Biometric machine natively over TCP/IP!");
                    Console.ResetColor();

                    DateTime lastCheckedTime = DateTime.Now;

                    while (true)
                    {
                        try
                        {
                            // Temporarily disable device to read logs safely
                            sbxpc.SBXPCDLL.EnableDevice(MACHINE_NUMBER, 0);

                            // Read general punch logs from device memory
                            bool readSuccess = sbxpc.SBXPCDLL.ReadAllGLogData(MACHINE_NUMBER);

                            if (readSuccess)
                            {
                                int tmno, seno, smno, vmode, yr, mon, day, hr, min, sec;
                                
                                // Retrieve logs in a loop
                                while (sbxpc.SBXPCDLL.GetGeneralLogData(MACHINE_NUMBER, out tmno, out seno, out smno, out vmode, out yr, out mon, out day, out hr, out min, out sec))
                                {
                                    DateTime punchTime = new DateTime(yr, mon, day, hr, min, sec);

                                    // Verify if the punch is new
                                    if (punchTime > lastCheckedTime)
                                    {
                                        Console.ForegroundColor = ConsoleColor.Yellow;
                                        Console.WriteLine(string.Format("[PUNCH DETECTED] Student Card/User ID: {0} | Time: {1:yyyy-MM-dd HH:mm:ss}", seno, punchTime));
                                        Console.ResetColor();

                                        // Push punch to the Django Cloud Server
                                        SyncPunchWithCloud(seno.ToString(), punchTime);

                                        lastCheckedTime = punchTime;
                                    }
                                }
                            }

                            // Re-enable device
                            sbxpc.SBXPCDLL.EnableDevice(MACHINE_NUMBER, 1);
                        }
                        catch (Exception ex)
                        {
                            Console.ForegroundColor = ConsoleColor.Red;
                            Console.WriteLine("[ERROR] Error occurred in polling loop: " + ex.Message);
                            Console.ResetColor();
                        }

                        // Polling delay: checks logs every 5 seconds
                        Thread.Sleep(5000);
                    }
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("[CRITICAL ERROR] Native Connection Failed! Verify IP, Port and Cable.");
                    Console.ResetColor();
                    Console.WriteLine("Retrying connection in 15 seconds...");
                    Thread.Sleep(15000);
                }
            }
        }

        private static void SyncPunchWithCloud(string cardNo, DateTime punchTime)
        {
            try
            {
                // Force TLS 1.2 for modern HTTPS servers
                System.Net.ServicePointManager.SecurityProtocol = (System.Net.SecurityProtocolType)3072;

                // Build the secure multi-tenant payload manually (avoid Newtonsoft dependency)
                string json = "{" +
                    "\"rfid_code\":\"" + cardNo + "\"," +
                    "\"school_id\":\"" + SCHOOL_ID + "\"," +
                    "\"punch_time\":\"" + punchTime.ToString("yyyy-MM-dd HH:mm:ss") + "\"" +
                    "}";

                using (System.Net.WebClient wc = new System.Net.WebClient())
                {
                    wc.Headers[System.Net.HttpRequestHeader.ContentType] = "application/json";
                    wc.Headers.Add("X-Device-Token", DEVICE_SECRET_KEY);
                    wc.Encoding = Encoding.UTF8;

                    // Sync POST request to Django
                    string responseBody = wc.UploadString(SERVER_URL, "POST", json);

                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("  [SYNCED] Card " + cardNo + " attendance posted to Django backend!");
                    Console.ResetColor();
                }
            }
            catch (System.Net.WebException webEx)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                string responseText = "";
                if (webEx.Response != null)
                {
                    try
                    {
                        using (var reader = new System.IO.StreamReader(webEx.Response.GetResponseStream()))
                        {
                            responseText = reader.ReadToEnd();
                        }
                    }
                    catch { }
                }
                Console.WriteLine("  [FAILED] Server rejected punch: " + webEx.Message + " | Response: " + responseText);
                Console.ResetColor();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("  [ERROR] HTTP post error: " + ex.Message);
                Console.ResetColor();
            }
        }
    }
}
