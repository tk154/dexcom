![Visitor Count](https://visitor-badge.laobi.icu/badge?page_id=faymaz.dexcom)

![Dexcom Gnome Shell - 1](img/Dexcom_0.png)

![Dexcom Gnome Shell - 2](img/Dexcom_1.png)

![Dexcom Gnome Shell - 3](img/Dexcom_2.jpg)

![Dexcom Gnome Shell - 4](img/Dexcom_3.jpg)

![Dexcom - Configuration Menu](img/Dexcom_config_menu_1.png)

![Dexcom - Configuration Menu](img/Dexcom_config_menu_2.png)

![Dexcom - Configuration Menu](img/Dexcom_config_menu_3.png)

# Dexcom Blood Glucose Monitor GNOME Extension

A GNOME Shell extension that displays real-time blood glucose levels from Dexcom Share in your GNOME top panel.

**Important Notice:** This extension is not affiliated, funded, or in any way associated with Dexcom.

## Features

- Real-time blood glucose level display in GNOME top panel
- Visual alerts based on customizable glucose thresholds
- Support for both mg/dL and mmol/L units
- Trend arrows showing glucose direction
- Configurable update intervals
- Support for both US and Non-US Dexcom servers

## Installation

### From GNOME Extensions Website
1. Visit [GNOME Extensions](https://extensions.gnome.org)
2. Search for "Dexcom Blood Glucose Monitor"
3. Click "Install"

### Manual Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/faymaz/dexcom
   ```
2. Copy to GNOME extensions directory:
   ```bash
   cp -r dexcom ~/.local/share/gnome-shell/extensions/dexcom@faymaz
   ```
3. Restart GNOME Shell:
   - Press Alt+F2
   - Type 'r'
   - Press Enter
   - For Wayland sessions, you need to log out and log back in.
4. Enable the extension using GNOME Extensions app or over CMD Line
   - Use a tool like `gnome-extensions-app` or `gnome-tweaks` to enable the "Dexcom Blood Glucose Monitor" extension.
   - Alternatively, you can enable it via the command line:

     ```bash
     gnome-extensions enable dexcom@faymaz
     ``` 
## Configuration

1. Open GNOME Extensions app
2. Find "Dexcom Blood Glucose Monitor" and click settings
3. Configure:
   - Dexcom Share username and password
   - Region (US or Non-US)
   - Preferred unit (mg/dL or mmol/L)
   - Update interval
   - High/Low glucose thresholds

## Privacy & Security

- This extension requires your Dexcom Share credentials
- Credentials are stored securely using GNOME's GSettings
- Data is fetched directly from Dexcom servers
- No data is collected, stored, or transmitted to any third party
- All communication is done securely over HTTPS

## Dependencies

- GNOME Shell 45 or later
- A valid Dexcom Share account with Share enabled
- Internet connection

## Troubleshooting

- **Extension Not Showing Up:** Make sure you've copied the extension to the correct directory and that GNOME Shell recognizes it.
- **Logs and Errors:** You can check GNOME Shell logs for errors using:

  ```bash
  journalctl /usr/bin/gnome-shell -f -o cat
  ```

## License

This extension is released under the GNU General Public License v3.0.


## Disclaimer

This project is not affiliated with Dexcom, Inc. Use at your own risk. Do not use this library for making medical decisions. Always verify glucose values using your official Dexcom receiver or app.


## Support

For issues, feature requests, or contributions, please visit:
[GitHub Issues](https://github.com/faymaz/dexcom/issues)

## Author

- [faymaz](https://github.com/faymaz)