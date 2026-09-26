!ifndef BUILD_UNINSTALLER
  Var ClipVaultStartupCommand
!endif

!macro customInit
  ReadRegStr $ClipVaultStartupCommand HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ClipVault"
  ; Older uninstallers remove this folder even when invoked for an upgrade.
  ; Keep the backup outside that folder so a failed upgrade remains recoverable.
  ${If} ${FileExists} "$APPDATA\ClipVault\settings.json"
    ClearErrors
    CopyFiles /SILENT "$APPDATA\ClipVault\settings.json" "$APPDATA\ClipVault-settings-upgrade-backup.json"
    ${If} ${Errors}
      MessageBox MB_OK|MB_ICONSTOP "ClipVault could not back up your settings. The installation has been stopped to protect your data." /SD IDOK
      Abort
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstall
  ${If} ${FileExists} "$APPDATA\ClipVault-settings-upgrade-backup.json"
    CreateDirectory "$APPDATA\ClipVault"
    ClearErrors
    CopyFiles /SILENT "$APPDATA\ClipVault-settings-upgrade-backup.json" "$APPDATA\ClipVault\settings.json"
    ${If} ${Errors}
      MessageBox MB_OK|MB_ICONSTOP "ClipVault could not restore your settings. Your backup is in $APPDATA\ClipVault-settings-upgrade-backup.json. Restore it before opening ClipVault." /SD IDOK
      Abort
    ${EndIf}
    Delete "$APPDATA\ClipVault-settings-upgrade-backup.json"
  ${EndIf}
  ; Preserve startup across old uninstallers and installation-path changes.
  ${If} $ClipVaultStartupCommand != ""
    ClearErrors
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ClipVault" '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" --startup'
    ${If} ${Errors}
      MessageBox MB_OK|MB_ICONEXCLAMATION "ClipVault could not restore Windows startup. Open ClipVault once to restore it from your saved settings." /SD IDOK
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  ${IfNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ClipVault"
    RMDir /r "$APPDATA\ClipVault"
  ${EndIf}
!macroend
