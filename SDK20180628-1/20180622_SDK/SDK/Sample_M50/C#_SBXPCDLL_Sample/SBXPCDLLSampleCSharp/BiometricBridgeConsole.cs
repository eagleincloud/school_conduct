using System;
using System.Text;
using System.Threading;

namespace SBXPCDLLSampleCSharp
{
    class BiometricBridgeConsole
    {
        // =========================================================================
        // CONFIGURATION - UPDATE THESE PARAMETERS FOR YOUR SCHOOL DEPLOYMENT
        // =========================================================================
        private const string DEVICE_IP = "192.168.0.103";        // Biometric machine IP (from photos)
        private const int DEVICE_PORT = 4370;                     // Biometric custom TCP port (from photos)
        private const int DEVICE_PASSWORD = 0;                    // Communication password (No/0)
        private const int MACHINE_NUMBER = 1;                     // Machine ID/Number (usually 1)
        private const string SCHOOL_ID = "DEFAULT";               // Unique school identifier for isolation
        private const string SERVER_URL = "https://school-management-system-l12n.onrender.com/api/attendance/biometric-punch/";
        private const string DEVICE_SECRET_KEY = "y0ur_Sup3r_S3cr3t_B1om3tr1c_K3y_987";
        // =========================================================================

        public static void Run(string[] args)
        {
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
