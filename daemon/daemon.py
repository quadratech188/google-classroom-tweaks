import sys
import json
import struct
import os
import shutil
import time

# Helper function to read a message from stdin
def get_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        sys.exit(0)
    message_length = struct.unpack('@I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

# Helper function to send a message to stdout
def send_message(message):
    encoded_message = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('@I', len(encoded_message)))
    sys.stdout.buffer.write(encoded_message)
    sys.stdout.buffer.flush()

def wait_for_file_and_move(filename, full_destination_path):
    downloads_folder = os.path.expanduser("~/Downloads")
    source_path = os.path.join(downloads_folder, filename)
    
    # Poll for file existence and completion
    max_attempts = 60 # Try for 60 * 1 second = 60 seconds
    attempt = 0
    last_size = -1

    while attempt < max_attempts:
        if os.path.exists(source_path):
            current_size = os.path.getsize(source_path)
            if current_size > 0 and current_size == last_size:
                # File exists and size hasn't changed, likely complete
                break
            last_size = current_size
        
        time.sleep(1) # Wait 1 second before next check
        attempt += 1
    
    if not os.path.exists(source_path) or os.path.getsize(source_path) == 0:
        return {"status": "error", "message": f"File did not appear or was empty: {source_path}"}

    # Ensure destination directory exists
    destination_dir = os.path.dirname(full_destination_path)
    os.makedirs(destination_dir, exist_ok=True)

    try:
        shutil.move(source_path, full_destination_path)
        return {
            "status": "success",
            "movedFrom": source_path,
            "movedTo": full_destination_path
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to move file: {e}"
        }

def main():
    while True:
        try:
            received_message = get_message()
            
            filename = received_message.get("filename")
            full_destination_path = received_message.get("fullDestinationPath")

            response = {"status": "error", "message": "Invalid message format"}

            if filename and full_destination_path:
                response = wait_for_file_and_move(filename, full_destination_path)
            
            send_message(response)

        except Exception as e:
            print(f"Daemon error: {e}", file=sys.stderr)
            sys.stderr.flush()
            send_message({"status": "error", "message": f"Daemon internal error: {e}"})

if __name__ == '__main__':
    main()