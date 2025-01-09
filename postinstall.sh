#!/bin/bash

# Ensure the script is run with root privileges
if [ "$EUID" -ne 0 ]; then 
    echo "Error: Please run this script with sudo or as root."
    exit 1
fi

# Define paths
INSTALL_DIR="/opt/dynex-wallet"
LIB_DIR="/usr/local/lib"
BIN_DIR="/usr/local/bin"
APP_RESOURCES="$APPDIR/resources/dnx"

# Create necessary directories
echo "Creating installation directories..."
mkdir -p "$INSTALL_DIR" || { echo "Failed to create $INSTALL_DIR"; exit 1; }
mkdir -p "$LIB_DIR" || { echo "Failed to create $LIB_DIR"; exit 1; }

# Copy files
echo "Copying files..."
cp -f "$APP_RESOURCES/DNX-service" "$INSTALL_DIR/" || { echo "Failed to copy DNX-service"; exit 1; }
cp -f "$APP_RESOURCES/DNX-node" "$INSTALL_DIR/" || { echo "Failed to copy DNX-node"; exit 1; }
cp -f "$APP_RESOURCES/libcurl.so.4" "$LIB_DIR/" || { echo "Failed to copy libcurl.so.4"; exit 1; }
cp -f "$APP_RESOURCES/libboost_filesystem.so.1.74.0" "$LIB_DIR/" || { echo "Failed to copy libboost_filesystem"; exit 1; }
cp -f "$APP_RESOURCES/libboost_program_options.so.1.74.0" "$LIB_DIR/" || { echo "Failed to copy libboost_program_options"; exit 1; }
cp -f "$APP_RESOURCES/libz.so.1" "$LIB_DIR/" || { echo "Failed to copy libz"; exit 1; }

# Set permissions
echo "Setting permissions..."
chmod +x "$INSTALL_DIR/DNX-service" || { echo "Failed to set execute permission on DNX-service"; exit 1; }
chmod +x "$INSTALL_DIR/DNX-node" || { echo "Failed to set execute permission on DNX-node"; exit 1; }
chmod 755 "$LIB_DIR/libcurl.so.4" || { echo "Failed to set permissions on libcurl.so.4"; exit 1; }
chmod 755 "$LIB_DIR/libboost_filesystem.so.1.74.0" || { echo "Failed to set permissions on libboost_filesystem"; exit 1; }
chmod 755 "$LIB_DIR/libboost_program_options.so.1.74.0" || { echo "Failed to set permissions on libboost_program_options"; exit 1; }
chmod 755 "$LIB_DIR/libz.so.1" || { echo "Failed to set permissions on libz"; exit 1; }

# Update dynamic linker cache
echo "Updating dynamic linker cache..."
ldconfig || { echo "ldconfig failed"; exit 1; }

# Create symbolic links
echo "Creating symbolic links..."
ln -sf "$INSTALL_DIR/DNX-service" "$BIN_DIR/DNX-service" || { echo "Failed to create symbolic link for DNX-service"; exit 1; }
ln -sf "$INSTALL_DIR/DNX-node" "$BIN_DIR/DNX-node" || { echo "Failed to create symbolic link for DNX-node"; exit 1; }

echo "Installation completed successfully!"