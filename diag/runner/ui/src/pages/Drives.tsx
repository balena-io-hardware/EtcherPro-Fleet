import { useEffect, useState } from 'react';
import { Box, Button, HighlightedName, Table, Txt } from 'rendition'
import { FioResult } from '../iterfaces/FioResult';

type DrivesPageProps = {
  onDataReceived?: (data: any) => void
  autoload?: boolean
}

type DrivesList = {
  path: string //--> /dev/disk/by-path/*
  device: string //--> /dev/sd[.]
}

export const Drives = ({ autoload, onDataReceived }: DrivesPageProps) => {
  const [drives, setDrives] = useState([] as Array<DrivesList>);
  const [fioCallStatus, setFioCallStatus] = useState<"none" | "ok" | "fail" | "inprogress">("none");
  const [fioResults, setFioResults] = useState<FioResult[]>([]);

  useEffect(() => {
    if (autoload) {
      (async () => await getDrives())()
    }
  }, [autoload])

  const getDrives = async () => {
    const res = await fetch(`/api/drives`)
    const drivesResponse = await res.json()
    setDrives(drivesResponse);
    if (onDataReceived) {
      onDataReceived({ devices: drivesResponse })
    }
  } 
  
  const callFioRun = async () => {
    if (fioCallStatus !== 'none') {
      await getDrives();
    }

    setFioCallStatus("inprogress");

    try {
      let devices = drives.map(d => d.path)
      const fioRun = await fetch(`/api/drives/fio`, { 
        method: 'POST',
        body: JSON.stringify({ 
          devices: devices, 
          bs: "1m", 
          invalidate: 1,
          overwrite: 1
        }),
        headers: {
          'Content-Type': 'application/json'
        },
      })
      
      if (fioRun.ok) {
        setFioCallStatus("ok")
        let fioRes = await fetch('/api/drives/fio/last')
        const lastRes = await fioRes.json()
        setFioResults([...fioResults, lastRes])
        if (onDataReceived) {
          onDataReceived({ devices: drives, results: lastRes })
        }
      } else {
        setFioCallStatus("fail")
      }
    } catch (error) {
      setFioCallStatus("fail")
    }
  }

  return (
    <Box style={{overflowY: 'auto'}}>
      <Box>
        <Button onClick={() => getDrives()}>Get available drives</Button>
      </Box>
      <br />
      <Box>
        <HighlightedName>{drives.length +' drives'}</HighlightedName>    
        &nbsp;
        <Button 
          primary={fioCallStatus === "none"} 
          danger={fioCallStatus === "fail"} 
          success={fioCallStatus === "ok"} 
          disabled={fioCallStatus === "inprogress"}
          onClick={() => callFioRun()}
        >
          Run fio
        </Button>
        <Txt italic>Takes about 30 seconds</Txt>
        <ol style={{paddingBottom: '20vh'}}>
        {
          fioResults.map((r, i) => 
            <>
              <li>
                <Txt>Name: {r.jobs[0].jobname} | Bandwith in kb/s </Txt>
                <Table 
                  columns={[
                    {
                      field: 'bw_min',
                      label: 'min'
                    },
                    {
                      field: 'bw_max',
                      label: 'max'
                    },
                    {
                      field: 'bw_mean',
                      label: 'mean'
                    },
                    {
                      field: 'bw_dev',
                      label: 'dev'
                    },
                  ]}
                  data={[r.jobs[0].write]}
                />
                <Box>
                  <Txt>
                    {r.disk_util?.map(d => <>|- {d.name} : {d.util} -|</>)}
                  </Txt>
                </Box>
              </li>
              <hr />
            </>
            )
        }
        </ol>
      </Box>      
    </Box>
  );
};