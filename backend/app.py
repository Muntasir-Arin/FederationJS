import eventlet
eventlet.monkey_patch() 
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
import os
import base64
import csv
import io
import threading
import time
from flask_cors import CORS  # Import CORS
import pandas as pd


app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app_data.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
CORS(app)  # Enable CORS
socketio = SocketIO(app, cors_allowed_origins="*")
db = SQLAlchemy(app)

# Directory to save uploaded files
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Database model for connected devices
class ConnectedDevice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(120), unique=True, nullable=False)
    sid = db.Column(db.String(120), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    client = db.Column(db.String(120), nullable=True, default='web')
    cpuCores = db.Column(db.Integer, nullable=True)
    gpu = db.Column(db.String(150), nullable=True)

# Database model for uploaded files
class UploadedFile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    file_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    sid = db.Column(db.String(120), nullable=False)



@app.route('/')
def handle_connect(auth):
    return jsonify({"status": "API is running"}), 200

@socketio.on('connect')
def handle_connect(auth=None): 
    print(f"Client connected: {request.sid}")
    device = ConnectedDevice.query.filter_by(sid=request.sid).first()
    if device:
        device.sid = request.sid
        device.status = 'connected'
        db.session.commit()
    else:
        uuid = request.args.get('uuid')
        print(f"Device UUID: {uuid}")
        device = ConnectedDevice.query.filter_by(uuid=uuid).first()
        if device:
            device.sid = request.sid
            device.status = 'connected'
            db.session.commit()
    emit('connect_ack', {'status': 'connected'}, to=request.sid)


@socketio.on('disconnect')
def handle_disconnect():
    """
    Handle client disconnection.
    """
    sid = request.sid
    uuid = request.args.get('uuid')
    print(f"Client disconnected: {sid}")

    # Update status in the database
    device = ConnectedDevice.query.filter_by(sid=sid).first()
    if device:
        device.status = "not available"
        db.session.commit()
        print(f"Device {device.uuid} marked as 'not available'")
    else:
        device = ConnectedDevice.query.filter_by(uuid=uuid).first()
        if device:
            device.status = "not available"
            db.session.commit()
            print(f"Device {device.uuid} marked as 'not available'")

    emit_all_devices()

@socketio.on('device_info')
def handle_device_info(data):
    """
    Handle the incoming device information from the frontend.
    """
    deviceuuid = data.get('uuid')
    while not deviceuuid:
        deviceuuid = data.get('uuid')
        time.sleep(.5)

    # Update device info in the database
    device = ConnectedDevice.query.filter_by(uuid=deviceuuid).first()
    if device:
        # You can extend the model and update the device info fields here if necessary
        device.client = data.get('client')
        device.cpuCores = data.get('cpuCores')
        gpu_info = data.get('gpu')
        if gpu_info:
            device.gpu = gpu_info.get('vendor')
        db.session.commit()
    else:
        
        new_device = ConnectedDevice(uuid=deviceuuid, sid=request.sid, status='connected', client=data.get('client'), cpuCores=data.get('cpuCores'), gpu=data.get('gpu').get('vendor'))
        db.session.add(new_device)
        db.session.commit()
        print(f"Device {deviceuuid} added to the database")

    emit('device_response', {'status': 'success', 'message': 'Device info received'})
    emit_all_devices()

@app.route('/upload_file', methods=['POST'])
def upload_file_rest():
    """
    Handle file upload via REST API (using form-data).
    """
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'No selected file'}), 400
    
    sid = request.form.get('sid')  # Assuming the session ID is provided in the form data
    
    if not sid:
        return jsonify({'status': 'error', 'message': 'Session ID (sid) is required'}), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({'status': 'error', 'message': 'Only .csv files are allowed'}), 400

    try:
        # Save the file to the server
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(file_path)

        # Store file metadata in the database
        uploaded_file = UploadedFile(file_name=file.filename, file_path=file_path, sid=sid)
        db.session.add(uploaded_file)
        db.session.commit()

        return jsonify({'status': 'success', 'message': 'File uploaded successfully'}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@socketio.on('get_tasks')
def handle_get_tasks():
    """
    Send the current task queue to the client.
    """
    tasks = UploadedFile.query.all()
    task_list = [{"file_name": task.file_name, "file_path": task.file_path, "sid": task.sid} for task in tasks]
    emit('task_queue', task_list)

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
    devices = ConnectedDevice.query.all()
    alldevices = [{"uuid": device.uuid, "sid": device.sid, "status": device.status} for device in devices]
    emit('all_devices', alldevices, broadcast=True)


UPLOAD_FOLDER = "uploads"
CHUNK_SIZE = 100  # Number of rows per chunk for splitting the dataset
TARGET_FILE = "hallucination_11k.csv"  # The specific file we want to process
def task_handler():
    """
    Background task handler to process tasks in the task queue.
    It will run in an infinite loop and process each task.
    """
    count = 0
    while True and count == 0:
        count = 1
        file_path = os.path.join(UPLOAD_FOLDER, TARGET_FILE)
        if not os.path.exists(file_path):
            print(f"{TARGET_FILE} not found. Waiting for file to be uploaded.")
            continue  # Wait until the file is uploaded
        try:
            # Read the CSV file using pandas
            df = pd.read_csv(file_path)

            # Split the dataframe into chunks
            chunks = [df.iloc[i:i + CHUNK_SIZE] for i in range(0, len(df), CHUNK_SIZE)]

            # Get connected devices from the database
            connected_devices = ConnectedDevice.query.filter_by(status='connected').all()

            if len(connected_devices) == 0:
                print("No connected devices available.")
                continue

            # Loop through the chunks and send each to a device
            for i, chunk in enumerate(chunks):
                # Find the device (loop through devices if there are more chunks than devices)
                device = connected_devices[i % len(connected_devices)]  # This will cycle through devices if there are more chunks than devices
                chunk_data = chunk.to_dict(orient='records')  # Convert chunk to a list of dictionaries

                # Send the chunk to the corresponding device
                emit('task_data', {'data': chunk_data}, to=device.sid)

                print(f"Sent chunk {i + 1} to device {device.uuid} ({device.sid})")

            # After processing the file, move it to an archive or mark it as processed
            archive_path = os.path.join(UPLOAD_FOLDER, 'processed', TARGET_FILE)
            os.rename(file_path, archive_path)
            print(f"File {TARGET_FILE} processed and moved to archive.")

        except Exception as e:
            print(f"Error processing file {TARGET_FILE}: {e}")

# Create tables
if __name__ == "__main__":
    # Create an application context and initialize the database tables
    with app.app_context():
        # Add the client column to the database
        if not hasattr(ConnectedDevice, 'client'):
            try:
                db.engine.execute('ALTER TABLE connected_device ADD COLUMN client STRING')
            except Exception as e:
                print(f"Error adding client column: {e}")

        # Create tables
        db.create_all()
        print("Database tables created successfully.")

        # Start the background task handler thread
        threading.Thread(target=task_handler, daemon=True).start()

    # Run the Flask application with SocketIO
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
