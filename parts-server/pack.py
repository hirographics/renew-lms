import os,zipfile,shutil
base='/tmp/pk';out='/mnt/user-data/outputs/renew-parts-server';common=open(os.path.dirname(os.path.abspath(__file__))+'/README_common.txt').read()
os.makedirs(out,exist_ok=True)
start={
'windows':"""Double-click "Start Renew Parts.bat". A black window opens and stays open. That window is the server.
The first time, Windows asks about the firewall. Choose "Allow" for private networks.
To use a different port, open the .bat file in Notepad and change 8080.

START IT AUTOMATICALLY WHEN THE COMPUTER TURNS ON
Double-click "Start automatically at sign-in.bat" once. After that the server starts each time this Windows user signs in.
To undo it, double-click "Stop starting automatically.bat".
Note: Claude built and tested the server program on Linux. The Windows .bat files are simple, but they have not been run on a Windows computer yet. Tell Claude if one fails.""",
'mac':"""Double-click "Start Renew Parts.command". A Terminal window opens and stays open. That window is the server.
The first time, macOS may say the program is from an unidentified developer.
If it does: right-click "Start Renew Parts.command", choose Open, then choose Open again.
If macOS still blocks it, open System Settings, Privacy & Security, and click "Open Anyway".
To use a different port, open the .command file in TextEdit and change 8080.

START IT AUTOMATICALLY WHEN THE COMPUTER TURNS ON
Open System Settings, General, Login Items. Add "Start Renew Parts.command".
Note: Claude built and tested the server program on Linux. The Mac build has not been run on a Mac yet. Tell Claude if it fails.""",
'linux':"""Open a terminal in this folder and run:   ./start.sh
To use a different port, edit start.sh and change 8080.

START IT AUTOMATICALLY WHEN THE COMPUTER TURNS ON
See the file renew-parts.service. It is a systemd unit. Edit the two paths in it, then:
   sudo cp renew-parts.service /etc/systemd/system/
   sudo systemctl enable --now renew-parts"""}
reset={'windows':'Close the server window. Double-click "Reset passcode and PIN.bat".',
'mac':'Close the server window. Open Terminal in this folder and run:   ./renew-parts-server-apple-silicon -data data -reset-setup\n(On an Intel Mac use renew-parts-server-intel.)',
'linux':'Stop the server. In this folder run:   ./renew-parts-server -data data -reset-setup'}
def pack(name,key,files):
    d=os.path.join(base,name);shutil.rmtree(d,ignore_errors=True);os.makedirs(d)
    for dst,(src,content,exe) in files.items():
        p=os.path.join(d,dst)
        if src:shutil.copy(src,p)
        else:open(p,'w',newline='\r\n' if dst.endswith('.bat') else '\n').write(content)
        os.chmod(p,0o755 if exe else 0o644)
    txt=common.replace('@@START@@',start[key]).replace('@@RESET@@',reset[key])
    open(os.path.join(d,'READ ME FIRST.txt'),'w',newline='\r\n' if key=='windows' else '\n').write(txt)
    z=os.path.join(out,name+'.zip')
    with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(os.listdir(d)):
            p=os.path.join(d,f);zi=zipfile.ZipInfo.from_file(p,name+'/'+f);zi.compress_type=zipfile.ZIP_DEFLATED
            zi.external_attr=(os.stat(p).st_mode&0xFFFF)<<16
            zf.writestr(zi,open(p,'rb').read())
    print(name,os.path.getsize(z)//1024,'KB',len(os.listdir(d)),'files')
pack('renew-parts-server-windows','windows',{
 'renew-parts-server.exe':(base+'/windows-amd64/renew-parts-server.exe',None,True),
 'Start Renew Parts.bat':(None,'@echo off\ntitle Renew Parts server - leave this window open\ncd /d "%~dp0"\nrenew-parts-server.exe -port 8080 -data "%~dp0data"\necho.\necho The server stopped. Read the message above.\npause\n',False),
 'Start automatically at sign-in.bat':(None,'@echo off\nschtasks /create /f /tn "Renew Parts Server" /sc onlogon /tr "\\"%~dp0Start Renew Parts.bat\\""\necho.\necho Done. The server will start each time this user signs in to Windows.\npause\n',False),
 'Stop starting automatically.bat':(None,'@echo off\nschtasks /delete /f /tn "Renew Parts Server"\npause\n',False),
 'Reset passcode and PIN.bat':(None,'@echo off\ncd /d "%~dp0"\necho This clears the lab passcode and the office PIN. Lab data is kept.\necho Close this window now if you do not want that.\npause\nrenew-parts-server.exe -data "%~dp0data" -reset-setup\npause\n',False)})
macsh='#!/bin/bash\ncd "$(dirname "$0")"\nARCH=$(uname -m)\nif [ "$ARCH" = "arm64" ]; then BIN=./renew-parts-server-apple-silicon; else BIN=./renew-parts-server-intel; fi\nxattr -d com.apple.quarantine "$BIN" 2>/dev/null\nchmod +x "$BIN"\n"$BIN" -port 8080 -data "$(pwd)/data"\necho\necho "The server stopped. Read the message above."\nread -n 1 -s -r -p "Press any key to close."\n'
pack('renew-parts-server-mac','mac',{
 'renew-parts-server-apple-silicon':(base+'/darwin-arm64/renew-parts-server',None,True),
 'renew-parts-server-intel':(base+'/darwin-amd64/renew-parts-server',None,True),
 'Start Renew Parts.command':(None,macsh,True)})
pack('renew-parts-server-linux','linux',{
 'renew-parts-server':(base+'/linux-amd64/renew-parts-server',None,True),
 'renew-parts-server-arm64':(base+'/linux-arm64/renew-parts-server',None,True),
 'start.sh':(None,'#!/bin/bash\ncd "$(dirname "$0")"\nBIN=./renew-parts-server; [ "$(uname -m)" = "aarch64" ] && BIN=./renew-parts-server-arm64\nexec "$BIN" -port 8080 -data "$(pwd)/data"\n',True),
 'renew-parts.service':(None,'[Unit]\nDescription=Renew Parts lab server\nAfter=network-online.target\n\n[Service]\n# change both paths to where this folder is\nWorkingDirectory=/opt/renew-parts-server\nExecStart=/opt/renew-parts-server/start.sh\nRestart=always\nRestartSec=3\n\n[Install]\nWantedBy=multi-user.target\n',False)})
