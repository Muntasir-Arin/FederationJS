'use client'

import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Upload, Download, RefreshCw, Laptop, Smartphone, Loader2 } from 'lucide-react'
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"

export default function Home() {
  const [deviceUUID, setDeviceUUID] = useState('')
  const [uploadHistory, setUploadHistory] = useState([])
  const [file, setFile] = useState(null)
  const [connectedDevices, setConnectedDevices] = useState([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const storedUUID = localStorage.getItem('deviceUUID') || generateUUID()
    setDeviceUUID(storedUUID)
    localStorage.setItem('deviceUUID', storedUUID)

    const simulatedDevices = [
      { uuid: storedUUID, type: 'browser', cores: 12, coresUsed: 6 },
      { uuid: generateUUID(), type: 'browser', cores: 8, coresUsed: 4 },
      { uuid: generateUUID(), type: 'browser', cores: 8, coresUsed: 4 },
      { uuid: generateUUID(), type: 'pc', cores: 16, coresUsed: 8 },
    ]
    setConnectedDevices(simulatedDevices)

  }, [])
  
  const handleConnect = () => {
    setIsConnected(!isConnected)
  }

  const handleFileChange = (event) => {
    setFile(event.target.files[0])
  }

  const handleUpload = async () => {
    if (!file) {
      console.log('Please select a file to upload.')
      return
    }

    if (!file.name.endsWith('.csv')) {
      console.log('Only CSV files are allowed.')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    // Add new upload as 'queued'
    const newUpload = {
      id: generateUUID(),
      filename: file.name,
      timestamp: new Date(new Date().getTime() - 15 * 60 * 60 * 1000).toISOString(), // Subtract 2 hours
      status: 'queued',
    }
    setUploadHistory(prev => [newUpload, ...prev])

    // Simulate upload progress
    const intervalId = setInterval(() => {
      setUploadProgress((prevProgress) => {
        if (prevProgress >= 100) {
          clearInterval(intervalId)
          setIsUploading(false)
          return 100
        }
        return prevProgress + 10
      })
    }, 100)

    // Change status to 'inprogress' after 2 seconds
    setTimeout(() => {
      setUploadHistory(prev => 
        prev.map(item => 
          item.id === newUpload.id ? { ...item, status: 'inprogress' } : item
        )
      )
    }, 15000)

    // Simulate processing time and set to 'done'
    setTimeout(() => {
      setUploadHistory(prev => 
        prev.map(item => 
          item.id === newUpload.id ? { ...item, status: 'done' } : item
        )
      )
    }, 500)
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
      })
    }

    return randomData
  }

  const refreshData = () => {
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 py-10">
      <div className="container mx-auto px-4">
        <div className="absolute top-4 left-4 bg-white p-2 rounded shadow">
          <p className="text-sm font-medium">Your Device UUID:</p>
          <p className="text-xs">{deviceUUID}</p>
        </div>
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-3xl font-bold">FederationJS</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex gap-4 mb-8">
              <Button onClick={handleConnect} variant={isConnected ? "destructive" : "default"}>
                {isConnected ? 'Disconnect' : 'Connect'}
              </Button>
              <div className="flex-1">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="mb-2"
                  disabled={isUploading}
                />
                <Button onClick={handleUpload} disabled={!file || isUploading}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV
                </Button>
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">
                    Connected Devices
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Connected Devices</SheetTitle>
                    <SheetDescription>
                      There are currently {connectedDevices.length} devices connected.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 space-y-4">
                    {connectedDevices.map((device) => (
                      <div key={device.uuid} className="flex items-center space-x-4">
                        {device.type === 'browser' ? <Smartphone className="h-6 w-6" /> : <Laptop className="h-6 w-6" />}
                        <div>
                          <p className="text-sm font-medium">{device.type === 'browser' ? 'Browser' : 'PC'}</p>
                          <p className="text-xs text-muted-foreground">{device.uuid}</p>
                          <p className="text-xs">Cores: {device.coresUsed}/{device.cores}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {isUploading && (
              <div className="mb-4">
                <p className="mb-2">Uploading...</p>
                <Progress value={uploadProgress} className="w-full" />
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
                            {item.status === 'inprogress' && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            {item.status === 'done' && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => {
      let jsonData = JSON.stringify(item.data, null, 2); // Replace `item.data` with the actual data
      const dummyData = new Array(1000).fill(item.data); // Add dummy data to increase size
      jsonData = JSON.stringify(dummyData, null, 2); // Recreate JSON string with large data
      
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'large_data.json'; // Adjust filename
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url); // Clean up the URL object
    }}
  >
    <Download className="mr-2 h-4 w-4" />
    Download
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

