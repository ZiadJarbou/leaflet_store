$f = 'C:\Users\User\Documents\verdent-projects\leaflet_store\src\pages\LeafletView.tsx'
$lines = Get-Content $f
$keep = $lines[0..2812] + $lines[3405..($lines.Length - 1)]
[System.IO.File]::WriteAllLines($f, $keep, [System.Text.UTF8Encoding]::new($false))
Write-Host "Done. Lines: $($keep.Length)"
