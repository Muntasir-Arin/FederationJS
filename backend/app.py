import eventlet
eventlet.monkey_patch() 
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
import os
import base64
import csv
import io
import threading
import time

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Dictionary to store connected devices, using UUID as the key and SID as the value
connected_devices = {}

# Task queue to store file upload tasks
task_queue = []

# Directory to save uploaded files
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def health_check():
    return jsonify({"status": "API is running"}), 200

@socketio.on('connect')
def handle_connect():
    """
    Handle new connection.
    """
    sid = request.sid
    device_uuid = request.args.get('uuid')  # Get the UUID sent by frontend during connection
    if not device_uuid:
        emit('error', {'status': 'error', 'message': 'UUID is required for connection'})
        print(f"Client connection failed: {sid}, UUID is required")
        return

    print(f"Client connected: {sid}, UUID: {device_uuid}")
    
    # Add the device to the connected_devices dictionary with UUID as the key
    connected_devices[device_uuid] = {"sid": sid, "status": "available"}
    
    # Emit all connected devices to the client
    emit_all_devices()

@socketio.on('disconnect')
def handle_disconnect():
    """
    Handle client disconnection.
    """
    sid = request.sid
    print(f"Client disconnected: {sid}")

    # Find and remove the device from the connected_devices dictionary using the sid
    device_uuid = None
    for uuid_key, device in connected_devices.items():
        if device["sid"] == sid:
            device_uuid = uuid_key
            break
    
    if device_uuid:
        # Update status and set to "not available"
        connected_devices[device_uuid]["status"] = "not available"
        print(f"Device {device_uuid} marked as 'not available'")

    emit_all_devices()

@socketio.on('device_info')
def handle_device_info(data):
    """
    Handle the incoming device information from the frontend.
    """
    sid = request.sid
    print(f"Received device info from {sid}: {data}")
    
    # Update device info based on the sid
    for device in connected_devices.values():
        if device["sid"] == sid:
            device.update(data)
            break

    emit('device_response', {'status': 'success', 'message': 'Device info received'})
    emit_all_devices()

@socketio.on('upload_file')
def handle_file_upload(data):
    """
    Handle CSV file upload from the frontend.
    """
    sid = request.sid
    file_name = data.get('file_name')
    file_content = data.get('file_content')  # Assume this is Base64-encoded content
    
    if not file_name or not file_content:
        emit('upload_response', {'status': 'error', 'message': 'Invalid file data'})
        return

    if not file_name.endswith('.csv'):
        emit('upload_response', {'status': 'error', 'message': 'Only .csv files are allowed'})
        return

    # Decode and save the file
    try:
        file_path = os.path.join(UPLOAD_FOLDER, f"{sid}_{file_name}")
        # Decode Base64 file content
        decoded_content = base64.b64decode(file_content)
        
        with open(file_path, 'wb') as f:
            f.write(decoded_content)  # Save the decoded file
        print(f"CSV file saved: {file_path}")
        
        # Add task to the queue
        task_queue.append({"sid": sid, "file_name": file_name})
        
        # Optionally, process the CSV file (if needed)
        process_csv(file_path)

        emit('upload_response', {'status': 'success', 'message': 'File uploaded successfully'})
    except Exception as e:
        print(f"Error saving file: {e}")
        emit('upload_response', {'status': 'error', 'message': str(e)})

@socketio.on('get_tasks')
def handle_get_tasks():
    """
    Send the current task queue to the client.
    """
    emit('task_queue', task_queue)

def process_csv(file_path):
    """
    Process the uploaded CSV file (optional).
    """
    try:
        with open(file_path, 'r') as f:
            csv_reader = csv.reader(f)
            for row in csv_reader:
                print(f"Row data: {row}")
                # Here you can add logic to process each row if needed
                # For example, storing the data in a database
    except Exception as e:
        print(f"Error processing CSV file: {e}")

def emit_all_devices():
    """
    Emit the list of all connected devices to all clients.
    """
    alldevices = []
    for key, value in connected_devices.items():
        alldevices.append({"uuid": key, "info": value})
    emit('all_devices', alldevices, broadcast=True)

def task_handler():
    """
    Background task handler to process tasks in the task queue.
    It will run in an infinite loop and process each task.
    """
    while True:
        if task_queue:
            # Get the first task in the queue
            task = task_queue.pop(0)
            print(f"Processing task: {task['file_name']} for SID: {task['sid']}")

            # Simulate some task processing (here we just print and wait)
            time.sleep(5)  # Wait for 5 seconds

            print(f"Task completed: {task['file_name']}")
        else:
            time.sleep(1)  # No tasks, wait for a while before checking again

if __name__ == '__main__':
    # Start the background task handler thread
    threading.Thread(target=task_handler, daemon=True).start()

    # Run the Flask application with SocketIO
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
