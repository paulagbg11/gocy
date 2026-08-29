# Genera los iconos de la PWA a partir de public/icons/source.png.
#
# La imagen original viene con las esquinas ya redondeadas y negro alrededor.
# iOS aplica su propio redondeado al icono, así que si dejásemos esas esquinas
# se verían picos negros por fuera de la máscara: recortamos hacia dentro para
# quedarnos solo con la parte a sangre de la foto.
Add-Type -AssemblyName System.Drawing

$dir = Join-Path $PSScriptRoot "..\public\icons"
$srcPath = Join-Path $dir "source.png"
$img = [System.Drawing.Image]::FromFile($srcPath)

$inset = 95
$side = $img.Width - (2 * $inset)

$cropped = New-Object System.Drawing.Bitmap $side, $side
$g = [System.Drawing.Graphics]::FromImage($cropped)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$srcRect = New-Object System.Drawing.Rectangle $inset, $inset, $side, $side
$dstRect = New-Object System.Drawing.Rectangle 0, 0, $side, $side
$g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$img.Dispose()

# Verifica que el recorte ya no tiene negro en las esquinas.
$corners = @(@(2, 2), @(($side - 3), 2), @(2, ($side - 3)), @(($side - 3), ($side - 3)))
foreach ($pt in $corners) {
  $c = $cropped.GetPixel($pt[0], $pt[1])
  Write-Output ("esquina {0},{1} -> R={2} G={3} B={4}" -f $pt[0], $pt[1], $c.R, $c.G, $c.B)
}

$targets = @{ 512 = "icon-512.png"; 192 = "icon-192.png"; 180 = "apple-touch-icon.png" }
foreach ($size in $targets.Keys) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g2 = [System.Drawing.Graphics]::FromImage($bmp)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g2.DrawImage($cropped, 0, 0, $size, $size)
  $g2.Dispose()
  $bmp.Save((Join-Path $dir $targets[$size]), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output ("generado {0} ({1}x{1})" -f $targets[$size], $size)
}
$cropped.Dispose()
