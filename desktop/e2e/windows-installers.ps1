$ErrorActionPreference = 'Stop'
function Run-Installer($file, $arguments) {
    $process = Start-Process -FilePath $file -ArgumentList $arguments -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "$file failed with exit code $($process.ExitCode)" }
}
$env:EMBER_TEST_DATA = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'com.arlecchino.ember/ember.sqlite3'
Write-Host "Windows profile database: $env:EMBER_TEST_DATA"
$bundle = 'src-tauri/target/release/bundle'
$nsis = (Get-ChildItem "$bundle/nsis/*.exe" -ErrorAction Stop | Select-Object -First 1).FullName
$msi = (Get-ChildItem "$bundle/msi/*.msi" -ErrorAction Stop | Select-Object -First 1).FullName
foreach ($kind in 'nsis','msi') {
    $folder = Join-Path $env:RUNNER_TEMP "installed-ember-$kind"
    if ($kind -eq 'nsis') { Run-Installer $nsis "/S /D=$folder" }
    else { Run-Installer msiexec "/i `"$msi`" /qn /norestart INSTALLDIR=`"$folder`"" }
    $exe = Get-ChildItem $folder -Filter 'ember-by-arlecchino.exe' -Recurse | Select-Object -First 1
    if (!$exe) { throw "Missing installed $kind app." }
    foreach ($action in 'seed','restart') {
        $log = Join-Path $env:RUNNER_TEMP "ember-$kind-$action.log"
        $app = Start-Process -FilePath $exe.FullName -PassThru -RedirectStandardError $log
        try {
            for ($i=0; $i -lt 90; $i++) {
                Start-Sleep -Milliseconds 500
                $app.Refresh()
                if ($app.HasExited) { throw "App exited during startup: $($app.ExitCode)" }
                if ($app.MainWindowHandle -ne 0 -and (Test-Path $env:EMBER_TEST_DATA)) { break }
            }
            Write-Host "Installed $kind window: $($app.MainWindowTitle)"
            if ($app.MainWindowTitle -notlike 'Ember*') { throw "Expected the Ember main window." }
            if (!(Test-Path $env:EMBER_TEST_DATA)) {
                Get-Content $log
                Get-Process -Name msedgewebview2 -ErrorAction SilentlyContinue | Select-Object ProcessName,Id
                Get-ChildItem $env:USERPROFILE -Filter ember.sqlite3 -Recurse -ErrorAction SilentlyContinue | Select-Object FullName
                throw "The installed window did not open its profile database."
            }
            node e2e/windows-installed.mjs $action $kind
            if ($LASTEXITCODE -ne 0) { throw "Installed $kind failed $action." }
        } finally {
            if (!$app.HasExited) {
                [void]$app.CloseMainWindow()
                if (!$app.WaitForExit(10000)) { $app.Kill(); $app.WaitForExit() }
            }
        }
    }
    if ($kind -eq 'nsis') { Run-Installer "$folder/uninstall.exe" '/S' }
    else { Run-Installer msiexec "/x `"$msi`" /qn /norestart" }
    Start-Sleep -Seconds 3
    if (Test-Path $exe.FullName) { throw "Uninstaller left the executable." }
    node e2e/windows-installed.mjs uninstall $kind
    if ($LASTEXITCODE -ne 0) { throw "Uninstaller removed history." }
}
