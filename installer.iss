; Inno Setup Script for Fee Management System
; Krishna Foundation's Shrimant Jayshreemaladevi Naik Nimbalkar Institute of Management Studies, Phaltan

#define MyAppName "Fee Management System"
#define MyAppVersion "1.1.0"
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
OutputBaseFilename=FeeManagementSystem_Setup_v1.1.0
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

[Code]
var
  AdminPage: TInputQueryWizardPage;
  IsUpgradeInstall: Boolean;

procedure InitializeWizard;
begin
  IsUpgradeInstall := False;

  // Create Custom Master Administrator Setup Page
  AdminPage := CreateInputQueryPage(
    wpSelectDir,
    'Master Administrator Account Setup',
    'Create the initial Administrator login credentials for Fee Management.',
    'For maximum counter security, default passwords are not used. Please create your master credentials:');

  AdminPage.Add('Staff Full Name (e.g. Mr. Shrikant):', False);
  AdminPage.Add('Administrator Username (min 3 chars, no spaces):', False);
  AdminPage.Add('Master Password (min 6 chars):', True);
  AdminPage.Add('Confirm Password:', True);

  AdminPage.Values[0] := 'Mr. Shrikant (Fee Admin)';
  AdminPage.Values[1] := 'admin';
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = AdminPage.ID then
  begin
    if FileExists(WizardDirValue + '\data\fees.db') then
    begin
      AdminPage.Description := 'Existing database detected. Leave password blank to keep current administrator credentials, or enter new credentials to update.';
    end
    else
    begin
      AdminPage.Description := 'Create the initial Administrator login credentials for Fee Management.';
    end;
  end;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  uName: String;
  pWord: String;
  cWord: String;
  DbExists: Boolean;
begin
  Result := True;
  if CurPageID = AdminPage.ID then
  begin
    DbExists := FileExists(WizardDirValue + '\data\fees.db');
    uName := Trim(AdminPage.Values[1]);
    pWord := AdminPage.Values[2];
    cWord := AdminPage.Values[3];

    // If upgrading existing system where database exists and user leaves password blank, keep existing credentials
    if DbExists and (pWord = '') and (cWord = '') then
    begin
      IsUpgradeInstall := True;
      Result := True;
      Exit;
    end;

    if Trim(AdminPage.Values[0]) = '' then
    begin
      MsgBox('Please enter the Administrator Full Name.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    if (Length(uName) < 3) or (Pos(' ', uName) > 0) then
    begin
      MsgBox('Username must be at least 3 characters long and cannot contain spaces.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    if Length(pWord) < 6 then
    begin
      MsgBox('Password must be at least 6 characters long.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    if pWord <> cWord then
    begin
      MsgBox('Passwords do not match. Please re-enter your password.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    IsUpgradeInstall := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  JsonContent: String;
  DataDir: String;
  JsonFile: String;
begin
  if CurStep = ssPostInstall then
  begin
    DataDir := ExpandConstant('{app}\data');
    JsonFile := DataDir + '\initial_admin.json';
    
    // Write admin config if this is a fresh setup
    if not IsUpgradeInstall then
    begin
      JsonContent := '{' +
        '"full_name": "' + AdminPage.Values[0] + '",' +
        '"username": "' + Trim(AdminPage.Values[1]) + '",' +
        '"password": "' + AdminPage.Values[2] + '"' +
        '}';
      ForceDirectories(DataDir);
      SaveStringToFile(JsonFile, JsonContent, False);
    end;
  end;
end;
