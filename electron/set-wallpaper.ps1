param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePath
)

$resolvedImage = (Resolve-Path -LiteralPath $ImagePath).Path

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DesktopWallpaper {
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool SystemParametersInfo(
        int action,
        int parameter,
        string value,
        int flags
    );
}
"@

# 채우기(Fill) 방식으로 표시합니다.
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name WallpaperStyle -Value '10'
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name TileWallpaper -Value '0'

$success = [DesktopWallpaper]::SystemParametersInfo(20, 0, $resolvedImage, 3)
if (-not $success) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "Windows 배경화면을 적용하지 못했습니다. Win32 오류: $code"
}
