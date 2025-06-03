const Service = require('node-windows').Service;
const path = require('path');
const fs = require('fs');

// Log file setup
const logFile = path.join(__dirname, 'service-install.log');
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(message);
}

try {
    log('Starting service installation process...');
    
    // Check if running as administrator
    const isAdmin = require('is-admin');
    if (!isAdmin()) {
        throw new Error('This script must be run as Administrator');
    }

    // Create daemon directory if it doesn't exist
    const daemonDir = path.join(__dirname, 'daemon');
    if (!fs.existsSync(daemonDir)) {
        log('Creating daemon directory...');
        fs.mkdirSync(daemonDir);
    }

    // Verify server.js exists
    const serverPath = path.join(__dirname, 'server.js');
    if (!fs.existsSync(serverPath)) {
        throw new Error(`server.js not found at ${serverPath}`);
    }
    log('Found server.js at: ' + serverPath);

    // Create the service
    log('Creating service configuration...');
    const svc = new Service({
        name: 'HDTube-Saver',
        description: 'HDTube Saver Video Downloader Service',
        script: serverPath,
        nodeOptions: [],
        env: {
            name: "NODE_ENV",
            value: "production"
        },
        workingDirectory: __dirname,
        allowServiceLogon: true,
        logpath: daemonDir
    });

    // Listen for the install event
    svc.on('install', function() {
        log('Service installed successfully!');
        svc.start();
        log('Service start command issued');
    });

    // Listen for the start event
    svc.on('start', function() {
        log('Service is starting...');
    });

    // Listen for the error event
    svc.on('error', function(err) {
        log('Service error: ' + JSON.stringify(err));
    });

    // Listen for the alreadyinstalled event
    svc.on('alreadyinstalled', function() {
        log('Service is already installed.');
        svc.start();
    });

    // Listen for the invalidinstallation event
    svc.on('invalidinstallation', function() {
        log('Invalid installation detected. Attempting to uninstall...');
        svc.uninstall();
    });

    // Listen for the uninstall event
    svc.on('uninstall', function() {
        log('Service uninstalled successfully.');
    });

    // Install the service
    log('Initiating service installation...');
    svc.install();

} catch (error) {
    log('FATAL ERROR: ' + error.message);
    log('Stack trace: ' + error.stack);
    process.exit(1);
} 