using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;

namespace SBXPCDLLSampleCSharp
{
    static class BiometricBridgeConsole
    {
        private const string DeviceIp = "192.168.0.150";
        private const int DevicePort = 4370;
        private const int DevicePassword = 0;
        private const int MachineNumber = 1;
        private const string SchoolId = "DEFAULT";
        private const string ServerUrl = "http://13.233.140.195/api/attendance/biometric-punch/";
        private const string DeviceSecretKey = "y0ur_Sup3r_S3cr3t_B1om3tr1c_K3y_987";
        private const string ErrorLogPath = "biometric_bridge_errors.log";

        public static void Run(string[] args)
        {
            Program.gMachineNumber = MachineNumber;
            sbxpc.SBXPCDLL.DotNET();
            sbxpc.SBXPCDLL._DisableTranseiveCallback();

            while (true)
            {
                try
                {
                    StartBridge();
                }
                catch (Exception ex)
                {
                    WriteError("Bridge crashed: " + ex);
                    Console.WriteLine("[RESTARTING] Bridge crashed. Restarting in 10 seconds...");
                    Thread.Sleep(TimeSpan.FromSeconds(10));
                }
            }
        }

        private static void StartBridge()
        {
            Console.WriteLine(new string('=', 60));
            Console.WriteLine("Biometric Bridge Service - School ID: [" + SchoolId + "]");
            Console.WriteLine("Connecting to Biometric Device " + DeviceIp + ":" + DevicePort + "...");
            Console.WriteLine(new string('=', 60));

            if (!sbxpc.SBXPCDLL.ConnectTcpip(MachineNumber, DeviceIp, DevicePort, DevicePassword))
            {
                int errorCode;
                sbxpc.SBXPCDLL.GetLastError(MachineNumber, out errorCode);
                throw new InvalidOperationException("Device connection failed: " + util.ErrorPrint(errorCode));
            }

            Console.WriteLine("[SUCCESS] Connected to biometric machine.");
            Console.WriteLine("Listening and polling for new punches. Syncing with: " + ServerUrl);

            DateTime lastCheckedPunchTime = DateTime.Now;
            var postedPunchKeys = new HashSet<string>();

            try
            {
                while (true)
                {
                    try
                    {
                        foreach (PunchLog punch in ReadPunchLogs())
                        {
                            if (punch.Timestamp <= lastCheckedPunchTime)
                            {
                                continue;
                            }

                            string punchKey = punch.RfidCode + "|" + punch.Timestamp.ToString("yyyy-MM-dd HH:mm:ss");
                            if (postedPunchKeys.Contains(punchKey))
                            {
                                continue;
                            }

                            Console.WriteLine("[PUNCH DETECTED] RFID/User ID: " + punch.RfidCode + " | Time: " + punch.Timestamp);
                            PostPunch(punch);
                            postedPunchKeys.Add(punchKey);

                            if (punch.Timestamp > lastCheckedPunchTime)
                            {
                                lastCheckedPunchTime = punch.Timestamp;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("[ERROR] Polling error: " + ex.Message);
                        WriteError("Polling error: " + ex);
                    }

                    Thread.Sleep(TimeSpan.FromSeconds(5));
                }
            }
            finally
            {
                try
                {
                    sbxpc.SBXPCDLL.EnableDevice(MachineNumber, 1);
                    sbxpc.SBXPCDLL.Disconnect(MachineNumber);
                }
                catch
                {
                }

                Console.WriteLine("[INFO] Connection closed.");
            }
        }

        private static IEnumerable<PunchLog> ReadPunchLogs()
        {
            var punches = new List<PunchLog>();
            int errorCode;

            sbxpc.SBXPCDLL.EnableDevice(MachineNumber, 0);

            try
            {
                if (!sbxpc.SBXPCDLL.ReadGeneralLogData(MachineNumber, 0))
                {
                    sbxpc.SBXPCDLL.GetLastError(MachineNumber, out errorCode);
                    Console.WriteLine("[WARNING] Could not read general logs: " + util.ErrorPrint(errorCode));
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
                        MachineNumber,
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
                sbxpc.SBXPCDLL.EnableDevice(MachineNumber, 1);
            }

            return punches;
        }

        private static void PostPunch(PunchLog punch)
        {
            string json = "{"
                + "\"rfid_code\":\"" + JsonEscape(punch.RfidCode) + "\","
                + "\"school_id\":\"" + JsonEscape(SchoolId) + "\","
                + "\"punch_time\":\"" + punch.Timestamp.ToString("yyyy-MM-dd HH:mm:ss") + "\""
                + "}";

            byte[] body = Encoding.UTF8.GetBytes(json);
            var request = (HttpWebRequest)WebRequest.Create(ServerUrl);
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Headers.Add("X-Device-Token", DeviceSecretKey);
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
                        Console.WriteLine("  [SYNCED] Server accepted punch: " + responseBody);
                    }
                    else
                    {
                        Console.WriteLine("  [FAILED] Server rejected punch: " + (int)response.StatusCode + " - " + responseBody);
                        WriteError("Server rejected punch for RFID " + punch.RfidCode + ": " + (int)response.StatusCode + " - " + responseBody);
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
                    Console.WriteLine("  [FAILED] Server rejected punch: " + (int)response.StatusCode + " - " + responseBody);
                    WriteError("Server rejected punch for RFID " + punch.RfidCode + ": " + (int)response.StatusCode + " - " + responseBody);
                }
            }
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

        private static void WriteError(string message)
        {
            try
            {
                File.AppendAllText(ErrorLogPath, "[" + DateTime.Now + "] " + message + Environment.NewLine);
            }
            catch
            {
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
