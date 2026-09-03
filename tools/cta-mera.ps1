# Measure the rendered CTA buttons, then save them as JPEG q82.
# Contrast is measured on the BACKGROUND only: pixels brighter than 0.45
# luminance are the white glyphs themselves and would pull the mean up.
Add-Type -AssemblyName System.Drawing
$SP  = "C:\Users\bauph\AppData\Local\Temp\claude\D--My-Documents-2026-Cyber-Hora-THIRD-BRAIN\45999605-2ab3-441d-a52f-ae2947501298\scratchpad"
$OUT = "D:\My Documents 2026\Cyber Hora\pesenta.bg\assets\img"

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$par = New-Object System.Drawing.Imaging.EncoderParameters(1)
$par.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 82)

function Lin([double]$c) { $c = $c / 255.0; if ($c -le 0.03928) { return $c / 12.92 } return [math]::Pow(($c + 0.055) / 1.055, 2.4) }
function Lum($p) { return 0.2126 * (Lin $p.R) + 0.7152 * (Lin $p.G) + 0.0722 * (Lin $p.B) }

foreach ($n in @("babo-asi","cyal-edin-svyat")) {
  $i = New-Object System.Drawing.Bitmap("$SP\cta-$n.png")

  # glyph bounding box
  $minx=9999;$maxx=0;$miny=9999;$maxy=0
  for ($y=280; $y -lt 375; $y++) { for ($x=10; $x -lt 700; $x++) {
    $p = $i.GetPixel($x,$y)
    if ($p.R -gt 225 -and $p.G -gt 225 -and $p.B -gt 225) {
      if($x -lt $minx){$minx=$x}; if($x -gt $maxx){$maxx=$x}
      if($y -lt $miny){$miny=$y}; if($y -gt $maxy){$maxy=$y} } } }

  # background luminance under and around the text, glyphs excluded
  $fon = New-Object System.Collections.ArrayList
  for ($y=[math]::Max($miny-14,6); $y -lt [math]::Min($maxy+14,374); $y++) {
    for ($x=[math]::Max($minx-14,6); $x -lt [math]::Min($maxx+70,970); $x++) {
      $l = Lum $i.GetPixel($x,$y)
      if ($l -le 0.45) { [void]$fon.Add($l) } } }
  $s = $fon | Sort-Object
  $med  = $s[[int]($s.Count*0.5)]
  $p90  = $s[[int]($s.Count*0.9)]
  $kmed = (1.0 + 0.05) / ($med + 0.05)
  $k90  = (1.0 + 0.05) / ($p90 + 0.05)

  $i.Save("$OUT\mail-cta-$n.jpg", $enc, $par)
  $kb = [math]::Round((Get-Item "$OUT\mail-cta-$n.jpg").Length / 1KB)
  $i.Dispose()

  "  == {0} ==" -f $n
  "     text box: x {0}..{1} (w {2}), y {3}..{4} (h {5})" -f $minx,$maxx,($maxx-$minx),$miny,$maxy,($maxy-$miny)
  "     background pixels sampled: {0}" -f $fon.Count
  "     contrast vs white: median {0}:1, brightest tenth {1}:1" -f ([math]::Round($kmed,1)), ([math]::Round($k90,1))
  "     saved: mail-cta-{0}.jpg  {1} KB" -f $n,$kb
  ""
}
