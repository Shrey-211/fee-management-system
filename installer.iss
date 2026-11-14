; Inno Setup Script for Fee Management System
; Krishna Foundation's Shrimant Jayshreemaladevi Naik Nimbalkar Institute of Management Studies, Phaltan

#define MyAppName "Fee Management System"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Krishna Foundation's SJNNIMS, Phaltan"
#define MyAppExeName "FeeManagementSystem.exe"
#define MyAppAssocName MyAppName + " File"

[Setup]
AppId={{D37F2C0B-9E3A-4F1C-984A-B8F12D756CE1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
OutputDir=releases
OutputBaseFilename=FeeManagementSystem_Setup_v1.0.0
SetupIconFile=assets\app_icon.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
CloseApplications=yes
RestartApplications=no
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Dirs]
Name: "{app}\data"
Name: "{app}\backups"

[Files]
; All files from the PyInstaller dist build except database and temporary runtime files
Source: "dist\FeeManagementSystem\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "data\fees.db,data\fees.db-*,backups\*"

; Install clean production database ONLY if it does not already exist on target machine (protects existing fee data)
Source: "dist\FeeManagementSystem\data\fees.db"; DestDir: "{app}\data"; Flags: onlyifdoesntexist uninsneveruninstall

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
