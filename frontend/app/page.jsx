'use client'
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = "http://127.0.0.1:5000";  // Update with your backend URL if necessary

export default function Home() {
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [status, setStatus] = useState('Not Sent');
  const [response, setResponse] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Generate a unique UUID for the device (can be static or dynamically generated)
    const deviceUUID = 'your-uuid-here' || generateUUID(); // Replace 'your-uuid-here' with a unique UUID if needed

    const socketInstance = io(SOCKET_URL, {
      query: { uuid: deviceUUID }  // Send UUID as a query parameter during connection
    });

    setSocket(socketInstance);

    // Wait for the connection to be established before emitting device info
    socketInstance.on('connect', () => {
      const deviceInfo = getDeviceInfo();
      socketInstance.emit('device_info', {
        sid: socketInstance.id,
        uuid: deviceUUID,
        ...deviceInfo,
      });

      setStatus('Sent');
    });

    // Listen for all connected devices from the backend
    socketInstance.on('all_devices', (devices) => {
      console.log("All devices:", devices);
      setConnectedDevices(devices);
    });

    // Listen for response from the backend when device info is sent
    socketInstance.on('device_response', (data) => {
      setResponse(data);
    });

    socketInstance.on('error', (err) => {
      console.error("Socket error:", err);
      setStatus('Error');
    });

    // Cleanup on component unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const sendDeviceInfo = () => {
    if (!socket) return; // Ensure socket is initialized

    const deviceInfo = getDeviceInfo();
    const deviceUUID = 'your-uuid-here'; // Replace with dynamic UUID or pass it from state if needed

    // Emit device info to the backend
    socket.emit('device_info', {
      sid: socket.id,  // Attach the socket ID to track the connection
      uuid: deviceUUID, // Pass UUID as part of the info
      ...deviceInfo,
    });

    setStatus('Sent');
  };

  const getDeviceInfo = () => {
    const userAgent = navigator.userAgent;
    const cpuCores = navigator.hardwareConcurrency || "Unavailable";

    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    let gpuVendor = "Unavailable";
    let gpuRenderer = "Unavailable";

    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "Unknown";
        gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "Unknown";
      }
    }

    return {
      userAgent,
      cpuCores,
      gpu: {
        vendor: gpuVendor,
        renderer: gpuRenderer,
      },
    };
  };

  const generateUUID = () => {
    // Simple UUID generator using random values
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Device Info Sender</h1>
      <button onClick={sendDeviceInfo}>Send Device Info</button>
      <p>Status: {status}</p>
      
      {response && (
        <div>
          <h2>Response from Server:</h2>
          <pre>{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}

      <h2>Connected Devices:</h2>
      <ul>
        {connectedDevices.length > 0 ? (
          connectedDevices.map((device, index) => (
            <li key={index}>
              <pre>{JSON.stringify(device, null, 2)}</pre>
            </li>
          ))
        ) : (
          <p>No devices connected.</p>
        )}
      </ul>
    </div>
  );
}
