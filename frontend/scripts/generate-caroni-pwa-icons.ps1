param(
  [string] $SourcePath = (Join-Path $PSScriptRoot '..\src\assets\icon-catalogo-geodatos.png')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$publicDir = Join-Path $PSScriptRoot '..\public'
$resolvedSource = (Resolve-Path -LiteralPath $SourcePath).Path
$source = [System.Drawing.Bitmap]::new($resolvedSource)

try {
  $targets = @(
    @{ Name = 'app-icon-192.png'; Size = 192; Fill = 1.0; Opaque = $false },
    @{ Name = 'app-icon-512.png'; Size = 512; Fill = 1.0; Opaque = $false },
    @{ Name = 'app-icon-maskable-192.png'; Size = 192; Fill = 0.62; Opaque = $true },
    @{ Name = 'app-icon-maskable-512.png'; Size = 512; Fill = 0.62; Opaque = $true },
    @{ Name = 'apple-touch-icon.png'; Size = 180; Fill = 0.9; Opaque = $true },
    @{ Name = 'favicon-16.png'; Size = 16; Fill = 1.0; Opaque = $false },
    @{ Name = 'favicon-32.png'; Size = 32; Fill = 1.0; Opaque = $false },
    @{ Name = 'favicon-64.png'; Size = 64; Fill = 1.0; Opaque = $false }
  )

  foreach ($target in $targets) {
    $size = [int] $target.Size
    $destinationPath = Join-Path $publicDir $target.Name
    if (!$target.Opaque -and $target.Fill -eq 1.0 -and
        $source.Width -eq $size -and $source.Height -eq $size) {
      Copy-Item -LiteralPath $resolvedSource -Destination $destinationPath -Force
      continue
    }
    $ratio = [Math]::Min($size * $target.Fill / $source.Width, $size * $target.Fill / $source.Height)
    $width = [int] [Math]::Round($source.Width * $ratio)
    $height = [int] [Math]::Round($source.Height * $ratio)
    $left = [int] [Math]::Floor(($size - $width) / 2)
    $top = [int] [Math]::Floor(($size - $height) / 2)
    $icon = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($icon)
      try {
        $background = if ($target.Opaque) { [System.Drawing.Color]::White } else { [System.Drawing.Color]::Transparent }
        $graphics.Clear($background)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $destination = [System.Drawing.Rectangle]::new($left, $top, $width, $height)
        $graphics.DrawImage($source, $destination, 0, 0, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel)
      } finally {
        $graphics.Dispose()
      }
      $icon.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $icon.Dispose()
    }
  }
} finally {
  $source.Dispose()
}

# PNG-backed ICO keeps transparency at all browser fallback sizes.
$sizes = @(16, 32, 64)
$frames = @($sizes | ForEach-Object { ,([System.IO.File]::ReadAllBytes((Join-Path $publicDir "favicon-$_.png"))) })
$stream = [System.IO.File]::Create((Join-Path $publicDir 'favicon.ico'))
$writer = [System.IO.BinaryWriter]::new($stream)
try {
  $writer.Write([uint16]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]$sizes.Count)
  $offset = 6 + 16 * $sizes.Count
  for ($index = 0; $index -lt $sizes.Count; $index++) {
    $writer.Write([byte]$sizes[$index])
    $writer.Write([byte]$sizes[$index])
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$frames[$index].Length)
    $writer.Write([uint32]$offset)
    $offset += $frames[$index].Length
  }
  foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
} finally {
  $writer.Dispose()
}

$png = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes((Join-Path $publicDir 'app-icon-512.png')))
$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,' + $png + '"/></svg>'
[System.IO.File]::WriteAllText((Join-Path $publicDir 'favicon.svg'), $svg, [System.Text.UTF8Encoding]::new($false))
