RENEW PARTS: LAB SERVER
Version 1.0.1

WHAT THIS IS
One program that runs on the lab server computer.
It serves the Renew Parts app to every phone and PC on the lab network.
It keeps the lab data in one folder next to the program. The folder name is "data".
No data leaves the building.

BEFORE YOU START
1. Put this whole folder somewhere permanent on the server computer.
   Do not run it from the Downloads folder or from inside the zip file.
   On Windows, do not put it in "Program Files". Windows blocks programs from saving data there.
   A good place is a new folder such as C:\RenewParts.
2. The server computer must stay on during lab hours.

START IT
@@START@@

FIRST-TIME SETUP (5 minutes, done once)
1. On the server computer, open a browser and go to:  http://localhost:8080
2. The setup screen opens. Type three things:
   - A lab passcode. Everyone types it once on each device.
   - An office PIN of 4 digits. It opens Stock, Reports and Drawer layout.
   - The names of the people who will use the app, one name on each line.
3. Sign in with your name and the passcode.

OPEN IT ON PHONES AND OTHER COMPUTERS
1. Look at the server window. It prints a line like:
      On phones and other PCs: http://192.168.1.50:8080
2. Type that address into the browser on the phone. The phone must be on the lab Wi-Fi.
3. Add the page to the home screen so it opens like an app.
Tip: ask whoever manages the lab network to give the server computer a fixed address.
If the address changes, the phones need the new one.

THE STATUS PILL (bottom left of the app)
- Green "Live" and your name: everything is saved.
- Amber "Saving": a change is on its way.
- Red "Not saved yet": the server does not answer. Your changes wait on the device.
  They are sent when the server answers again. Do not clear the browser data while it is red.
Tap the pill to sign out. With the office PIN you can also edit the name list,
change the passcode, update the app and download a backup file.

BACKUPS
The program saves a copy of the database once a day in:  data/backups
It keeps the last 60 days.
For real protection, include the "data" folder in the lab's normal server backup.
If the server disk dies and there is no outside backup, the parts history is lost.

UPDATE THE APP
When Claude ships a new version of the app:
tap the status pill, then "Update the app". The server needs internet for this step only.
The previous version is kept in data/app as index.previous.html.

MOVE TO A NEW COMPUTER
Stop the program. Copy this whole folder, including "data", to the new computer. Start it there.

IF SOMETHING IS WRONG
- A phone cannot open the page: check the phone is on the lab Wi-Fi, and that the server window is open.
- The page opens on the server but not on phones: the firewall on the server blocks it. Allow the program on private networks.
- "Port already in use": another program uses port 8080. Start with a different port, for example 8090. See START IT.
- Forgot the office PIN or the passcode: stop the server, then see "RESET THE PASSCODE AND PIN" below.

RESET THE PASSCODE AND PIN
This clears the passcode and the office PIN and signs every device out. Lab data is kept.
@@RESET@@
Then start the server and open it. The setup screen shows again. Type the new passcode, PIN and names.
