# ------------------------------------------------------------------
# 出勤轻松记 · 微信小程序
# 版权所有 © 2026 dakerclaw，保留所有权利。
# 本文件属专有软件，未经授权不得复制、修改、分发或用于商业用途。
# 详见项目根目录 LICENSE 文件。
# ------------------------------------------------------------------
# 生成自定义 tabBar 图标（96x96 PNG，透明背景）

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'assets'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function New-TabIcon {
  param(
    [string]$Type,
    [string]$Color,
    [string]$File
  )

  $bmp = New-Object System.Drawing.Bitmap 96, 96
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($Color)), 7
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($Color))

  switch ($Type) {
    'clock' {
      $g.DrawEllipse($pen, 13, 13, 70, 70)
      $g.DrawLine($pen, 48, 48, 48, 27)
      $g.DrawLine($pen, 48, 48, 65, 57)
      $g.FillEllipse($brush, 43, 43, 10, 10)
    }
    'calendar' {
      $g.DrawRectangle($pen, 13, 21, 70, 63)
      $g.DrawLine($pen, 13, 40, 83, 40)
      $g.DrawLine($pen, 31, 12, 31, 30)
      $g.DrawLine($pen, 65, 12, 65, 30)
      $g.FillRectangle($brush, 29, 54, 8, 8)
      $g.FillRectangle($brush, 44, 54, 8, 8)
      $g.FillRectangle($brush, 59, 54, 8, 8)
      $g.FillRectangle($brush, 29, 68, 8, 8)
      $g.FillRectangle($brush, 44, 68, 8, 8)
      $g.FillRectangle($brush, 59, 68, 8, 8)
    }
    'search' {
      $g.DrawEllipse($pen, 13, 13, 52, 52)
      $g.DrawLine($pen, 60, 60, 83, 83)
    }
  }

  $path = Join-Path $outDir $File
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

  $pen.Dispose()
  $brush.Dispose()
  $g.Dispose()
  $bmp.Dispose()
  Write-Output "wrote $path"
}

New-TabIcon -Type 'clock' -Color '#7A7A7A' -File 'tab-record.png'
New-TabIcon -Type 'clock' -Color '#0052D9' -File 'tab-record-active.png'
New-TabIcon -Type 'calendar' -Color '#7A7A7A' -File 'tab-month.png'
New-TabIcon -Type 'calendar' -Color '#0052D9' -File 'tab-month-active.png'
New-TabIcon -Type 'search' -Color '#7A7A7A' -File 'tab-history.png'
New-TabIcon -Type 'search' -Color '#0052D9' -File 'tab-history-active.png'
