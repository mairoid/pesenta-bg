# Производни от мастерите. Мащабът е от целия кадър — режем само където
# съотношението го налага, и то по вертикала, симетрично.
Add-Type -AssemblyName System.Drawing

$IZH = "D:\My Documents 2026\Cyber Hora\pesenta.bg\assets\img"
$MAS = "D:\My Documents 2026\Cyber Hora\THIRD BRAIN\pesenta-flags\rojden-den-asi"

$kodek = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
         Where-Object { $_.MimeType -eq "image/jpeg" }
$par = New-Object System.Drawing.Imaging.EncoderParameters(1)
$par.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, 82)

function Izrejzi-I-Mashtabiray {
    param($izvor, $izhod, $sirok, $visok, [double]$vertOtmestvane = 0.5)

    $src = [System.Drawing.Image]::FromFile($izvor)

    # Кой размер стяга: сравняваме съотношенията, режем по по-широката ос.
    $celSaotn = $sirok / $visok
    $srcSaotn = $src.Width / $src.Height
    if ($srcSaotn -gt $celSaotn) {
        $ch = $src.Height
        $cw = [int][math]::Round($src.Height * $celSaotn)
    } else {
        $cw = $src.Width
        $ch = [int][math]::Round($src.Width / $celSaotn)
    }
    $cx = [int][math]::Round(($src.Width  - $cw) * 0.5)
    $cy = [int][math]::Round(($src.Height - $ch) * $vertOtmestvane)

    $bmp = New-Object System.Drawing.Bitmap($sirok, $visok,
           [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # TileFlipXY спира призрачния ръб, който бикубичната дава по краищата.
    $atr = New-Object System.Drawing.Imaging.ImageAttributes
    $atr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $sirok, $visok)),
                 $cx, $cy, $cw, $ch, [System.Drawing.GraphicsUnit]::Pixel, $atr)

    $g.Dispose()
    $bmp.Save($izhod, $kodek, $par)
    $bmp.Dispose(); $src.Dispose(); $atr.Dispose()

    $kb = [math]::Round((Get-Item $izhod).Length / 1KB)
    "    {0,-38} {1,4}x{2,-4} от изрез {3}x{4}  {5} KB" -f `
        (Split-Path $izhod -Leaf), $sirok, $visok, $cw, $ch, $kb
}

foreach ($p in @(@{s="babo-asi"; m="babo-asi-1.88.png"},
                 @{s="cyal-edin-svyat"; m="cyal-svyat-1.88.png"})) {
    "  == $($p.s) =="
    $iz = "$MAS\$($p.m)"
    Izrejzi-I-Mashtabiray $iz "$IZH\pesen-$($p.s)-hero.jpg"     1200 638
    Izrejzi-I-Mashtabiray $iz "$IZH\pesen-$($p.s)-hero-600.jpg"  600 319
    Izrejzi-I-Mashtabiray $iz "$IZH\og-$($p.s).jpg"             1200 630
    ""
}
