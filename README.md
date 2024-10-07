![Visitor Count](https://visitor-badge.laobi.icu/badge?page_id=faymaz.dexcom)

# Dexcom Blood Glucose Monitor for GNOME Shell

**Dexcom Blood Glucose Monitor** is a GNOME Shell extension that integrates with the Dexcom Share API to display real-time blood glucose levels in the GNOME top bar. The extension provides visual alerts with color-coded indicators based on glucose thresholds, ensuring that users are promptly notified of significant changes in their glucose levels.

## Features

- **Real-Time Monitoring**: Seamless integration with Dexcom Share API to display live blood glucose readings.
- **Color-Coded Alerts**: The glucose value in the top bar is color-coded based on thresholds:
  - **Green**: Glucose level is between 90 mg/dL and 210 mg/dL (normal).
  - **Yellow**: Glucose level is above 210 mg/dL (high).
  - **Red**: Glucose level is below 90 mg/dL (low).
- **Automatic Updates**: Blood glucose readings are refreshed automatically every 3 minutes.
- **Minimal Interface**: A clean, non-intrusive design that integrates into the GNOME Shell's top panel.

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/faymaz/dexcom.git
   ```
2. **Move the Extension**:
   Copy the cloned extension to your GNOME extensions directory:
   ```bash
   cp -r gnome-dexcom-monitor ~/.local/share/gnome-shell/extensions/dexcom@faymaz/
   ```
3. **Restart GNOME Shell**:
   To apply changes, press `Alt + F2`, type `r`, and press Enter. This will restart GNOME Shell.

4. **Enable the Extension**:
   Use GNOME Tweaks or the GNOME Extensions app to enable the extension.

## Configuration

1. Open the `extension.js` file located in the extension folder.
2. Edit the following lines to include your Dexcom Share account credentials:
   ```javascript
   const USERNAME = 'your_username';
   const PASSWORD = 'your_password';
   ```
   Make sure your Dexcom Share credentials are correctly set up.

## Usage

Once the extension is enabled, your current blood glucose reading will be displayed in the GNOME top bar. The color of the text will change based on the glucose level, allowing you to quickly assess your current status.

- **Green**: Normal glucose range (90-210 mg/dL).
- **Yellow**: High glucose level (above 210 mg/dL).
- **Red**: Low glucose level (below 90 mg/dL).

The readings are updated every 3 minutes, ensuring you always have up-to-date information on your blood glucose levels.

## Requirements

- A Dexcom Share account.
- GNOME Shell version 3.36 or higher.
- Internet connection to fetch real-time glucose data.

## Troubleshooting

If you encounter issues with the extension, you can troubleshoot by reviewing the GNOME Shell logs. To view the logs, use the following command:
```bash
journalctl -f /usr/bin/gnome-shell
```

Any errors related to the extension will be displayed in the logs. Additionally, you can use GNOME's built-in debugging tool, Looking Glass (`Alt + F2` -> `lg`), to check for errors or run JavaScript code in real-time.

## Contributing

Contributions to the Dexcom Blood Glucose Monitor extension are welcome! Feel free to submit pull requests, report bugs, or suggest new features. To contribute:
1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request detailing your changes.

## License

This extension is licensed under the MIT License. See the `LICENSE` file for details.
