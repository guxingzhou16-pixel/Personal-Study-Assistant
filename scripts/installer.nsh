; This release uses an interactive license page. Do not bypass it via update/silent flags.
; customInit is only called for the installer, never the uninstaller.
!macro customInit
  IfSilent 0 +3
    SetErrorLevel 1602
    Quit
  ${if} ${isUpdated}
    SetErrorLevel 1602
    Quit
  ${endif}
!macroend
