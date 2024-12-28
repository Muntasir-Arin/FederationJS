import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = "http://127.0.0.1:5000"; // Replace with your backend URL

export default function useSocket() {
    const [socket, setSocket] = useState(null);
    const [response, setResponse] = useState(null);

    useEffect(() => {
        const socketInstance = io(SOCKET_URL);
        setSocket(socketInstance);

        // Listen for responses from the backend
        socketInstance.on('device_response', (data) => {
            setResponse(data);
        });

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    const sendDeviceInfo = (deviceInfo) => {
        if (socket) {
            socket.emit('device_info', deviceInfo);
        }
    };

    return { sendDeviceInfo, response };
}
