using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows.Forms;
using System.Threading.Tasks;

namespace SBXPCDLLSampleCSharp
{
    static class Program
    {
        public static int gMachineNumber;
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main(string[] args)
        {
            // Launch the background console biometric bridge natively using official DLL SDK
            BiometricBridgeConsole.Run(args);
        }
    }
}
