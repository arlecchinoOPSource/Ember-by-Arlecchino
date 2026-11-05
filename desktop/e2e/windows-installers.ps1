$ErrorActionPreference = 'Stop'
function Run-Installer($file, $arguments) {
    $process = Start-Process -FilePath $file -ArgumentList $arguments -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "$file failed with exit code $($process.ExitCode)" }
}
$bundle = 'src-tauri/target/release/bundle'
$nsis = (Get-ChildItem "$bundle/nsis/*.exe" -ErrorAction Stop | Select-Object -First 1).FullName
$msi = (Get-ChildItem "$bundle/msi/*.msi" -ErrorAction Stop | Select-Object -First 1).FullName
foreach ($kind in 'nsis','msi') {
    $folder = Join-Path $env:RUNNER_TEMP "installed-ember-$kind"
    if ($kind -eq 'nsis') { Run-Installer $nsis "/S /D=$folder" }
    else { Run-Installer msiexec "/i `"$msi`" /qn /norestart INSTALLDIR=`"$folder`"" }
    $exe = Get-ChildItem $folder -Filter 'ember-by-arlecchino.exe' -Recurse | Select-Object -First 1
    if (!$exe) { throw "Missing installed $kind app." }
    node e2e/windows-installed.mjs $exe.FullName $kind
    if ($LASTEXITCODE -ne 0) { throw "Installed $kind app failed its smoke test." }
    if ($kind -eq 'nsis') { Run-Installer "$folder/uninstall.exe" '/S' }
    else { Run-Installer msiexec "/x `"$msi`" /qn /norestart" }
    Start-Sleep -Seconds 3
    if (Test-Path $exe.FullName) { throw "Uninstaller left the executable." }
    if (!(Test-Path "$env:APPDATA/com.arlecchino.ember/ember.sqlite3")) { throw "Uninstaller removed history." }
}
