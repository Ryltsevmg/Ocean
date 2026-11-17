!include "LogicLib.nsh"

Var oceanFinalDirectory
Var oceanNewDirectory
Var oceanOldDirectory
Var oceanOldMoved
Var oceanNewMoved
Var oceanDirectoryError
Var oceanDirectorySource
Var oceanDirectoryDestination
Var oceanRestoreError
Var oceanDirectoryLogDirectory
Var oceanRecoveryStopped

; MoveFileEx preserves the destination and exposes the Windows error before rollback changes it.
; Open files inside a directory can make its rename return access denied (5).
!macro oceanDirectoryOperation SOURCE DESTINATION RESULT PHASE
  Push $0
  Push $1
  Push $2
  StrCpy $0 0
  ${Do}
    ${If} "${DESTINATION}" == ""
      System::Call 'kernel32::RemoveDirectoryW(w "${SOURCE}") i.r1 ?e'
    ${Else}
      System::Call 'kernel32::MoveFileExW(w "${SOURCE}", w "${DESTINATION}", i 0) i.r1 ?e'
    ${EndIf}
    Pop ${RESULT}
    ${If} "${DESTINATION}" == ""
      ${If} ${RESULT} == 2
      ${OrIf} ${RESULT} == 3
        StrCpy $1 1
      ${EndIf}
    ${EndIf}
    ${If} $1 != 0
      StrCpy ${RESULT} 0
      ${ExitDo}
    ${EndIf}
    ClearErrors
    FileOpen $2 "$PLUGINSDIR\directory-operations.log" a
    ${IfNot} ${Errors}
      FileSeek $2 0 END
      FileWrite $2 "${PHASE}: Windows error: ${RESULT}$\r$\n"
      FileClose $2
    ${EndIf}
    ${If} ${RESULT} != 5
    ${AndIf} ${RESULT} != 32
    ${AndIf} ${RESULT} != 33
      ${ExitDo}
    ${EndIf}
    IntOp $0 $0 + 1
    ${If} $0 >= 10
      ${ExitDo}
    ${EndIf}
    IntOp $1 $0 * 250
    Sleep $1
  ${Loop}
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro oceanReportDirectoryFailure
  ${If} $oceanRestoreError != 0
    StrCpy $oceanRecoveryStopped "1"
  ${EndIf}
  !ifmacrodef customInstallerDirectoryFailed
    !insertmacro customInstallerDirectoryFailed
  !else
    DetailPrint "Directory operation failed ($oceanDirectoryError): $oceanDirectorySource -> $oceanDirectoryDestination; restore error: $oceanRestoreError"
  !endif
!macroend

!macro oceanExtractPayload FILE
  !ifmacrodef customInstallerExtract
    !insertmacro customInstallerExtract "${FILE}"
  !else
    nsExec::ExecToStack '"$PLUGINSDIR\ocean-7za.exe" x -y -bd -bb0 "-o$INSTDIR" "${FILE}"'
    Pop $R0
    Pop $R1
  !endif
  ${If} $R0 != 0
    DetailPrint $R1
    Call oceanRollbackDirectories
    !ifmacrodef customInstallerExtractFailed
      !insertmacro customInstallerExtractFailed "${FILE}"
    !else
      MessageBox MB_OK|MB_ICONEXCLAMATION "$(decompressionFailed)" /SD IDOK
    !endif
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro oceanStageApplication
  !ifdef OCEAN_INSTALLER_LOG_DIR
    ; electron-builder defines the cache name after including our function bodies, before this section expands.
    StrCpy $oceanDirectoryLogDirectory "${OCEAN_INSTALLER_LOG_DIR}"
  !endif
  StrCpy $oceanFinalDirectory $INSTDIR
  System::Call 'ole32::CoCreateGuid(g .r0) i .r1'
  ${If} $1 != 0
    SetErrorLevel 2
    Quit
  ${EndIf}
  StrCpy $oceanNewDirectory "$INSTDIR.new-$0"
  StrCpy $oceanOldDirectory "$INSTDIR.old-$0"
  StrCpy $oceanOldMoved ""
  StrCpy $oceanNewMoved ""
  StrCpy $oceanDirectoryError 0
  StrCpy $oceanRestoreError 0
  StrCpy $oceanRecoveryStopped ""
  ClearErrors
  CreateDirectory $oceanNewDirectory
  ${If} ${Errors}
    SetErrorLevel 2
    Quit
  ${EndIf}
  File /oname=$PLUGINSDIR\ocean-7za.exe "${OCEAN_SEVENZIP_PATH}"
  StrCpy $INSTDIR $oceanNewDirectory
  SetOutPath $INSTDIR
  !insertmacro installApplicationFiles
  !ifdef OCEAN_SEVENZIP_LICENSE_DIR
    File /oname=7zip-installer-LICENSE.txt "${OCEAN_SEVENZIP_LICENSE_DIR}\LICENSE.txt"
    File /oname=7zip-installer-COPYING.txt "${OCEAN_SEVENZIP_LICENSE_DIR}\COPYING"
  !endif
  !ifdef UNINSTALLER_ICON
    File /oname=uninstallerIcon.ico "${UNINSTALLER_ICON}"
  !endif
  StrCpy $INSTDIR $oceanFinalDirectory
  SetOutPath $PLUGINSDIR
!macroend

Function .onGUIEnd
  Call oceanCleanupDirectories
FunctionEnd

Function oceanCleanupDirectories
  ${If} $oceanRecoveryStopped == "1"
    Return
  ${EndIf}
  ${If} $oceanFinalDirectory != ""
    Call oceanRollbackDirectories
  ${EndIf}
FunctionEnd

; Only directories created or renamed by this installer are removed during rollback.
Function oceanRollbackDirectories
  SetOutPath $PLUGINSDIR
  ${If} $oceanNewMoved == "1"
    RMDir /r "\\?\$oceanFinalDirectory"
    StrCpy $oceanNewMoved ""
  ${EndIf}
  ${If} $oceanOldMoved == "1"
    !insertmacro oceanDirectoryOperation "$oceanOldDirectory" "$oceanFinalDirectory" $oceanRestoreError "restore"
    ${If} $oceanRestoreError != 0
      ; Leave the complete backup in place if another process prevents restoration.
      DetailPrint $oceanOldDirectory
      RMDir /r "\\?\$oceanNewDirectory"
      Return
    ${EndIf}
    StrCpy $oceanOldMoved ""
  ${EndIf}
  ${If} $oceanNewDirectory != ""
    RMDir /r "\\?\$oceanNewDirectory"
  ${EndIf}
  StrCpy $INSTDIR $oceanFinalDirectory
FunctionEnd

Function oceanPromoteDirectories
  !ifmacrodef InstallerPublishStage
    !insertmacro InstallerPublishStage 2
  !endif
  ; SetOutPath opens a directory handle; release it before either rename.
  SetOutPath $PLUGINSDIR
  ClearErrors
  ${If} ${FileExists} "$oceanFinalDirectory\*.*"
    StrCpy $oceanDirectorySource $oceanFinalDirectory
    StrCpy $oceanDirectoryDestination $oceanOldDirectory
    !insertmacro oceanDirectoryOperation "$oceanDirectorySource" "$oceanDirectoryDestination" $oceanDirectoryError "backup"
    ${If} $oceanDirectoryError != 0
      Call oceanRollbackDirectories
      !insertmacro oceanReportDirectoryFailure
      SetErrors
      Return
    ${EndIf}
    StrCpy $oceanOldMoved "1"
  ${Else}
    ; NSIS can create the destination before the install section starts.
    StrCpy $oceanDirectorySource $oceanFinalDirectory
    StrCpy $oceanDirectoryDestination ""
    !insertmacro oceanDirectoryOperation "$oceanDirectorySource" "" $oceanDirectoryError "remove-empty"
    ${If} $oceanDirectoryError != 0
      Call oceanRollbackDirectories
      !insertmacro oceanReportDirectoryFailure
      SetErrors
      Return
    ${EndIf}
  ${EndIf}
  ClearErrors
  StrCpy $oceanDirectorySource $oceanNewDirectory
  StrCpy $oceanDirectoryDestination $oceanFinalDirectory
  !insertmacro oceanDirectoryOperation "$oceanDirectorySource" "$oceanDirectoryDestination" $oceanDirectoryError "promote"
  ${If} $oceanDirectoryError != 0
    Call oceanRollbackDirectories
    !insertmacro oceanReportDirectoryFailure
    SetErrors
    Return
  ${EndIf}
  StrCpy $oceanNewMoved "1"
  SetOutPath $oceanFinalDirectory
  !ifmacrodef InstallerPublishStage
    !insertmacro InstallerPublishStage 3
  !endif
  ClearErrors
FunctionEnd

!macro oceanFinishDirectories
  StrCpy $oceanNewMoved ""
  ${If} $oceanOldMoved == "1"
    RMDir /r "\\?\$oceanOldDirectory"
    StrCpy $oceanOldMoved ""
  ${EndIf}
!macroend
