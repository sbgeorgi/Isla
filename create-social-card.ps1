Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot 'assets/social-card.png'
$image = [System.Drawing.Bitmap]::new(1200, 630)
$graphics = [System.Drawing.Graphics]::FromImage($image)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#173D3A'))

$cream = [System.Drawing.ColorTranslator]::FromHtml('#F7F5EE')
$sea = [System.Drawing.ColorTranslator]::FromHtml('#9BE3D2')
$quiet = [System.Drawing.ColorTranslator]::FromHtml('#BCD1C9')
$shape = [System.Drawing.Drawing2D.GraphicsPath]::new()
$shape.AddArc(76, 90, 32, 32, 180, 90)
$shape.AddArc(184, 90, 32, 32, 270, 90)
$shape.AddArc(184, 198, 32, 32, 0, 90)
$shape.AddArc(76, 198, 32, 32, 90, 90)
$shape.CloseFigure()
$tile = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#22524C'))
$graphics.FillPath($tile, $shape)
$symbolPen = [System.Drawing.Pen]::new($cream, 9)
$symbolPen.StartCap = $symbolPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$symbolPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$graphics.DrawLine($symbolPen, 111, 184, 111, 125)
$graphics.DrawBezier($symbolPen, 111, 125, 181, 117, 183, 166, 123, 168)
$graphics.DrawLine($symbolPen, 151, 167, 180, 192)
$wavePen = [System.Drawing.Pen]::new($sea, 5)
$wavePen.StartCap = $wavePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawBezier($wavePen, 95, 203, 117, 190, 133, 190, 151, 203)
$graphics.DrawBezier($wavePen, 151, 203, 168, 216, 185, 216, 205, 203)

$whiteBrush = [System.Drawing.SolidBrush]::new($cream)
$seaBrush = [System.Drawing.SolidBrush]::new($sea)
$quietBrush = [System.Drawing.SolidBrush]::new($quiet)
$logoFont = [System.Drawing.Font]::new('Arial', 59, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$titleFont = [System.Drawing.Font]::new('Georgia', 72, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$smallFont = [System.Drawing.Font]::new('Arial', 19, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$urlFont = [System.Drawing.Font]::new('Arial', 22, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$graphics.DrawString('Roatan', $logoFont, $whiteBrush, 243, 111)
$graphics.DrawString('.Design', $logoFont, $seaBrush, 450, 111)
$graphics.DrawString('Websites with a', $titleFont, $whiteBrush, 76, 283)
$graphics.DrawString('sense of place.', $titleFont, $whiteBrush, 76, 368)
$graphics.DrawLine([System.Drawing.Pen]::new($sea, 3), 77, 485, 1123, 485)
$graphics.DrawString('BESPOKE DIGITAL EXPERIENCES FOR EXTRAORDINARY STAYS', $smallFont, $quietBrush, 76, 516)
$graphics.DrawString('roatan.design', $urlFont, $seaBrush, 938, 559)

$image.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$image.Dispose()
$shape.Dispose()
$tile.Dispose()
$symbolPen.Dispose()
$wavePen.Dispose()
$whiteBrush.Dispose()
$seaBrush.Dispose()
$quietBrush.Dispose()
$logoFont.Dispose()
$titleFont.Dispose()
$smallFont.Dispose()
$urlFont.Dispose()
Write-Output "Created $out"
