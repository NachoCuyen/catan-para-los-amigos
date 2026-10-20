using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;

public class CatanLauncher
{
    private static bool IsServerResponding()
    {
        try
        {
            using (WebClient wc = new WebClient())
            {
                string json = wc.DownloadString("http://localhost:3000/api/server-info");
                return !string.IsNullOrEmpty(json);
            }
        }
        catch
        {
            return false;
        }
    }

    private static void EnsureServerStarted(string baseDir)
    {
        if (IsServerResponding()) return;

        try
        {
            string nodePath = @"C:\Program Files\nodejs\node.exe";
            if (!File.Exists(nodePath)) nodePath = "node";

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = nodePath;
            psi.Arguments = "\"" + Path.Combine(baseDir, "server", "index.js") + "\"";
            psi.WorkingDirectory = baseDir;
            psi.CreateNoWindow = true;
            psi.UseShellExecute = false;
            Process.Start(psi);

            // Esperar hasta 4 segundos a que el servidor responda antes de abrir la ventana única
            for (int i = 0; i < 16; i++)
            {
                Thread.Sleep(250);
                if (IsServerResponding()) break;
            }
        }
        catch { }
    }

    private static void OpenSingleGameWindow(string url)
    {
        try
        {
            try
            {
                Process.Start(new ProcessStartInfo("msedge.exe", "--app=" + url) { UseShellExecute = true });
                return;
            }
            catch { }

            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch { }
    }

    [STAThread]
    public static void Main()
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        EnsureServerStarted(baseDir);
        OpenSingleGameWindow("http://localhost:3000");
    }
}
