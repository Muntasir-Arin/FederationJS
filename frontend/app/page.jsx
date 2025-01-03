'use client'

import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Upload, Download, RefreshCw } from 'lucide-react'
import io from 'socket.io-client'

const SOCKET_URL = "http://127.0.0.1:5000"

export default function Home() {
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [uploadHistory, setUploadHistory] = useState([])
  const [deviceUUID, setDeviceUUID] = useState('')
  const [uploadStatus, setUploadStatus] = useState(null)
  const [file, setFile] = useState(null)

  


  useEffect(() => {
    const initialize = async () => {
      const storedUUID = localStorage.getItem('deviceUUID')
      if (storedUUID) {
        setDeviceUUID(storedUUID)
      } else {
        const storedUUID = generateUUID()
        localStorage.setItem('deviceUUID', storedUUID)
        setDeviceUUID(storedUUID)
      }
      while (!storedUUID) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const socketInstance = io(SOCKET_URL, {
        query: { uuid: storedUUID }
      })

      setSocket(socketInstance)

      socketInstance.on('connect', () => {
        setConnected(true)
        const deviceInfo = getDeviceInfo()
        socketInstance.emit('device_info', {
          sid: socketInstance.id,
          client: 'web',
          uuid: storedUUID,
          ...deviceInfo,
        })
      })

      socketInstance.on('disconnect', () => {
        setConnected(false)
        const deviceInfo = getDeviceInfo()
        socketInstance.emit('device_info', {
          sid: socketInstance.id,
          client: 'web',
          uuid: storedUUID,
          ...deviceInfo,
        })
      })

      socketInstance.on('upload_status', (data) => {
        setUploadHistory(prev => {
          const index = prev.findIndex(item => item.id === data.id)
          if (index !== -1) {
            const newHistory = [...prev]
            newHistory[index] = data
            return newHistory
          }
          return [...prev, data]
        })
      })

      // Generate initial random data
      setUploadHistory(generateRandomData())
    }

    initialize()

    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [])
  
  const handleConnect = () => {
    if (socket) {
      if (!connected) {
        socket.connect()
      } else {
        socket.disconnect()
      }
    }
  }

  const getDeviceInfo = () => {
    const userAgent = navigator.userAgent
    const cpuCores = navigator.hardwareConcurrency || "Unavailable"

    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    let gpuVendor = "Unavailable"
    let gpuRenderer = "Unavailable"

    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "Unknown"
        gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "Unknown"
      }
    }

    return {
      userAgent,
      cpuCores,
      gpu: {
        vendor: gpuVendor,
        renderer: gpuRenderer,
      },
    }
  }

  const handleFileChange = (event) => {
    setFile(event.target.files[0])
  }

  const handleUpload = async () => {
    if (!file) {
      console.log('Please select a file to upload.');
      return;
    }
  
    if (!file.name.endsWith('.csv')) {
      console.log('Only CSV files are allowed.');
      return;
    }
  
    try {
      // Prepare FormData to send the file as part of the HTTP request
      const formData = new FormData();
      formData.append('file', file);  // Append the file
      formData.append('sid', socket.id);  // Append the session ID (from Socket.IO or your own logic)
  
      // Make the POST request to the server
      const response = await fetch('http://localhost:5000/upload_file', {
        method: 'POST',
        body: formData,
      });
  
      const data = await response.json();
      if (response.ok) {
        console.log('File uploaded successfully:', data.message);
      } else {
        console.error('Error uploading file:', data.message);
      }
  
    } catch (error) {
      console.error('Error uploading the file:', error);
    } finally {
      console.log('Upload complete.');
    }
  }
  


  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const getStatusBadge = (status) => {
    const variants = {
      queued: 'secondary',
      inprogress: 'warning',
      done: 'success',
    }

    return <Badge variant={variants[status]}>{status}</Badge>
  }

  const generateRandomData = () => {
    const statuses = ['queued', 'inprogress', 'done']
    const randomData = []

    for (let i = 0; i < 3; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      randomData.push({
        id: generateUUID(),
        filename: i === 0 ? 'spam_data.csv' : `sample_dataset_${i}.csv`,
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 10000000)).toISOString(),
        status: status,
        downloadUrl: status === 'done' ? `https://example.com/download/${generateUUID()}` : null
      })
    }

    return randomData
  }

  const refreshData = () => {
    setUploadHistory(generateRandomData())
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 py-10">
      <div className="container mx-auto px-4">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-3xl font-bold">FederationJS</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex gap-4 mb-8">
              <Button onClick={handleConnect} variant={connected ? "destructive" : "default"}>
                {connected ? 'Disconnect' : 'Connect'}
              </Button>
              <div className="">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className=""
                  disabled={!connected}
                />
                <Button onClick={handleUpload} disabled={!connected || !file}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV
                </Button>
              </div>
            </div>

            {uploadStatus && (
              <div className={`mb-4 p-2 rounded ${uploadStatus.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {uploadStatus.message}
              </div>
            )}

            <Tabs defaultValue="history" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="history" className="flex-1">Upload History</TabsTrigger>
              </TabsList>
              <TabsContent value="history" className="mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Recent Uploads</h3>
                  <Button variant="outline" size="sm" onClick={refreshData}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                <div className="space-y-4">
                  {uploadHistory.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No upload history available</p>
                  ) : (
                    uploadHistory.map((item) => (
                      <Card key={item.id} className="hover:shadow-md transition-shadow duration-200">
                        <CardContent className="flex items-center justify-between p-4">
                          <div>
                            <p className="font-medium">{item.filename}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(item.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            {getStatusBadge(item.status)}
                            {item.status === 'done' && item.downloadUrl && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={item.downloadUrl} download>
                                  <Download className="mr-2 h-4 w-4" />
                                  Download
                                </a>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

