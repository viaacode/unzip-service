# Unzip Service
Service that unzips a directory communicating with messages

###Usage
Modify the startup.sh script to suit your needs and run it.

Publish a message on the request queue in the following format:

```json
{
    "correlation_id": "abc123",
    "source_filename": "actual_zipfile.zip",
    "source_filepath": "/path/to/zipfile"
}
```

Once the service receives this request it will start unzipping the zip file into a folder with the same name (/path/to/zipfile/actual_zipfile in the above example).

The service will respond with a message on the response queue in the following format:

```json
{
	"success": true,
	"correlation_id": "abc123",
	"destination_path": "/path/to/zipfile/actual_zipfile"
}
```