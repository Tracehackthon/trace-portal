param([string[]]$Paths)
# Read-only PNG verification. Does not transform, crop, recolor, or save images.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
function UInt32BE([byte[]]$Bytes, [int]$Offset) {
  return ([uint32]$Bytes[$Offset] * 16777216 + [uint32]$Bytes[$Offset+1] * 65536 + [uint32]$Bytes[$Offset+2] * 256 + [uint32]$Bytes[$Offset+3])
}
$results = foreach ($path in $Paths) {
  $resolved = (Resolve-Path -LiteralPath $path).Path
  $bytes = [System.IO.File]::ReadAllBytes($resolved)
  if ([Convert]::ToHexString($bytes[0..7]) -ne '89504E470D0A1A0A') { throw "Not PNG: $resolved" }
  $chunks = [System.Collections.Generic.List[string]]::new()
  $offset = 8
  while ($offset -lt $bytes.Length) {
    $length = UInt32BE $bytes $offset
    $kind = [System.Text.Encoding]::ASCII.GetString($bytes, $offset+4, 4)
    $chunks.Add($kind)
    $offset += [int]$length + 12
    if ($kind -eq 'IEND') { break }
  }
  $colorType = $bytes[25]
  $hasAlpha = ($colorType -in @(4,6)) -or ($chunks -contains 'tRNS')
  $bitmap = [System.Drawing.Bitmap]::new($resolved)
  $samples = @()
  foreach ($point in @(@(0,0), @(10,10), @(20,20), @(($bitmap.Width-1),0), @(0,($bitmap.Height-1)), @(($bitmap.Width-1),($bitmap.Height-1)))) {
    $pixel = $bitmap.GetPixel([int]$point[0], [int]$point[1])
    $samples += [ordered]@{x=$point[0];y=$point[1];alpha=$pixel.A;r=$pixel.R;g=$pixel.G;b=$pixel.B}
  }
  [ordered]@{
    path=$resolved
    bytes=$bytes.Length
    width=$bitmap.Width
    height=$bitmap.Height
    pixel_format=$bitmap.PixelFormat.ToString()
    png_color_type=$colorType
    png_chunk_types=@($chunks | Select-Object -Unique)
    has_alpha_or_trns=$hasAlpha
    alpha_min= $(if (-not $hasAlpha) {255} else {$null})
    alpha_max= $(if (-not $hasAlpha) {255} else {$null})
    alpha_evidence= $(if (-not $hasAlpha) {'PNG color type has no alpha and no tRNS chunk: all decoded pixels are opaque.'} else {'Alpha channel/tRNS present; full pixel scan required to determine transparency.'})
    corner_samples=$samples
    sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $resolved).Hash
  }
  $bitmap.Dispose()
}
$results | ConvertTo-Json -Depth 8
