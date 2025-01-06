# puppylog

## API

### GET /api/logs
Get logs

#### Query

| Field     | DataType | Description                       |
| --------- | -------- | --------------------------------- |
| start     | DateTime | Start time for logs               |
| end       | DateTime | End time for logs                 |
| loglevel  | enum[]   | Debug, Info, Warning, Error       |
| project   | int[]    | Project identifier                |
| env       | int[]    | env type prod, dev ....           |
| device    | int[]    | Id of the device                  |
| search    | string[] | Message payload of the logmessage |

#### Response

```json
[
    {
        "timestamp": "",
        "loglevel": 2,
        "project": 5,
        "env": 1,
        "device": 1234,
        "message": "Log message"
    }
]
```

### GET /api/logs/stream

#### Query

| Field     | DataType | Description                       |
| --------- | -------- | --------------------------------- |
| loglevel  | enum[]   | Debug, Info, Warning, Error       |
| project   | int[]    | Project identifier                |
| env       | int[]    | env type prod, dev ....           |
| device    | int[]    | Id of the device                  |
| search    | string[] | Message payload of the logmessage |

#### Response
Returns eventstream of json objects like this.

data:
```json
{
    "timestamp": "",
    "loglevel": 2,
    "project": 5,
    "env": 1,
    "device": 1234,
    "message": "Log message"
}
```



### GET /api/commands
Event stream which receives commands from server. This can be used to control the clients like do they send logs or not. In some environments data amount need to be restricted like IOT devices so log sending can be turned on demand.

**Command**

|Field       |Size|Description             |
|------------|----|------------------------|
|type        | 1  | Type of command        |
|payload len | 4  | Payload of the command |

**Stream Command**

**Send logs**

| Field       | Size | Description              |
|-------------|------|--------------------------|
| Start date  | 8    | Earliest logline to send |
| End date    | 8    | Lastest logline to send  |

### POST /api/logs

Device can send batch of loglines to server in compressed format like tar.gz. Payload will have one or more loglines is specified format.

Content-Encoding: gzip or none

**Logline**

|Field      |Size|Description             |
|-----------|----|------------------------|
| timestamp | 8  | Timestamp of the log   |
| loglevel  | 1  | Log level              |
| project   | 4  | Project identifier     |
| env       | 4  | Environment identifier |
| device    | 4  | Device identifier      |
| msglen    | 4  | Length of the message  |
| message   | x  | Log message            |

### POST /api/logs/stream

Stream logs to server. Because this method has higher bandwidth usage it is recommended to use it only when needed. For example when debugging some issue.

Transfer-Encoding: chunked

```
size of logline\r\n
Logline(same format as normal post) \r\n
... more loglines
0\r\n
\r\n
```


### POST /api/device/{devid}/rawlogs

Post raw logs as they are stored in device. However this might require user to insert some processing rules if the log schema is not automatically detectable. There could be some basic asumptions like timestamp is in certain format or it is the first column.

Content-Type: text/plain
Content-Encoding: gzip or none

Logs in plain text format...

### POST /api/device/{devid}/rawlogs/stream

Stream raw logs to server. This is useful when logs are generated in real time and they are not stored in the device. This can be used to stream logs from the device to the server.

Transfer-Encoding: chunked

```
size of logline\r\n
Logline\r\n
... more loglines
0\r\n