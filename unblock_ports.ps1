
# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Requesting Administrator privileges..."
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "Adding Firewall Rule for Supabase/PostgreSQL (Ports 5432, 6543)..." -ForegroundColor Cyan

try {
    New-NetFirewallRule -DisplayName "Supabase PostgreSQL" `
                        -Direction Outbound `
                        -LocalPort 5432,6543 `
                        -Protocol TCP `
                        -Action Allow `
                        -Profile Any

    New-NetFirewallRule -DisplayName "Supabase PostgreSQL" `
                        -Direction Inbound `
                        -LocalPort 5432,6543 `
                        -Protocol TCP `
                        -Action Allow `
                        -Profile Any

    Write-Host "✅ Success! Ports 5432 and 6543 are now open." -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to add firewall rule: $_" -ForegroundColor Red
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
