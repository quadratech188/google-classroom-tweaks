package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

// Message from extension
type MessageFromExtension struct {
	Filename          string `json:"filename"`
	FullDestinationPath string `json:"fullDestinationPath"`
}

// Response to extension
type MessageToExtension struct {
	Status    string `json:"status"`
	Message   string `json:"message,omitempty"`
	MovedFrom string `json:"movedFrom,omitempty"`	
	MovedTo   string `json:"movedTo,omitempty"`
}

// Helper to read a message from stdin
func getMessage() (MessageFromExtension, error) {
	var msgLen uint32
	if err := binary.Read(os.Stdin, binary.LittleEndian, &msgLen); err != nil {
		return MessageFromExtension{}, fmt.Errorf("failed to read message length: %w", err)
	}

	rawMessage := make([]byte, msgLen)
	if _, err := io.ReadFull(os.Stdin, rawMessage); err != nil {
		return MessageFromExtension{}, fmt.Errorf("failed to read message: %w", err)
	}

	var message MessageFromExtension
	if err := json.Unmarshal(rawMessage, &message); err != nil {
		return MessageFromExtension{}, fmt.Errorf("failed to unmarshal JSON: %w", err)
	}
	return message, nil
}

// Helper to send a message to stdout
func sendMessage(message MessageToExtension) error {
	encodedMessage, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	if err := binary.Write(os.Stdout, binary.LittleEndian, uint32(len(encodedMessage))); err != nil {
		return fmt.Errorf("failed to write message length: %w", err)
	}
	if _, err := os.Stdout.Write(encodedMessage); err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}
	return nil
}

func waitForFileAndMove(sourceFilePath, fullDestinationPath string) MessageToExtension {
	maxAttempts := 60 // Try for 60 * 1 second = 60 seconds
	attempt := 0
	var lastSize int64 = -1

	for attempt < maxAttempts {
		fileInfo, err := os.Stat(sourceFilePath)
		if err == nil { // File exists
			currentSize := fileInfo.Size()
			if currentSize > 0 && currentSize == lastSize {
				// File exists and size hasn't changed, likely complete
				break
			}
			lastSize = currentSize
		} else if !os.IsNotExist(err) {
			// Some other error than file not existing
			return MessageToExtension{Status: "error", Message: fmt.Sprintf("Error checking file status: %v", err)}
		}

		time.Sleep(1 * time.Second)
		attempt++
	}

	// Final check if file exists and is not empty
	fileInfo, err := os.Stat(sourceFilePath)
	if os.IsNotExist(err) || fileInfo.Size() == 0 {
		return MessageToExtension{Status: "error", Message: fmt.Sprintf("File did not appear or was empty: %s", sourceFilePath)}
	}

	// Check if destination file already exists
	_, destErr := os.Stat(fullDestinationPath)
	if destErr == nil { // Destination file exists
		return MessageToExtension{Status: "error", Message: fmt.Sprintf("File already exists at destination: %s", fullDestinationPath)}
	} else if !os.IsNotExist(destErr) {
		// Some other error checking destination file status
		return MessageToExtension{Status: "error", Message: fmt.Sprintf("Error checking destination file status: %v", destErr)}
	}

	// Ensure destination directory exists
	destinationDir := filepath.Dir(fullDestinationPath)
	if err := os.MkdirAll(destinationDir, 0755); err != nil {
		return MessageToExtension{Status: "error", Message: fmt.Sprintf("Failed to create destination directory: %v", err)}
	}

	// Always attempt copy-then-delete for robustness across file systems
    if err := copyFile(sourceFilePath, fullDestinationPath); err != nil {
        return MessageToExtension{Status: "error", Message: fmt.Sprintf("Failed to copy file: %v", err)}
    }

    // If copy was successful, remove the original file
    if err := os.Remove(sourceFilePath); err != nil {
        // Log a warning if removal fails, but consider the move successful if copy succeeded
        fmt.Fprintf(os.Stderr, "Warning: Failed to remove original file %s after successful copy: %v\n", sourceFilePath, err)
    }

	return MessageToExtension{Status: "success", MovedFrom: sourceFilePath, MovedTo: fullDestinationPath}
}

// copyFile is a helper for cross-device moves
func copyFile(src, dst string) (err error) {
    in, err := os.Open(src)
    if err != nil {
        return
    }
    defer in.Close()

    out, err := os.Create(dst)
    if err != nil {
        return
    }
    defer func() {
        if cerr := out.Close(); cerr != nil && err == nil {
            err = cerr
        }
    }()

    _, err = io.Copy(out, in)
    return
}


func main() {
	for {
		message, err := getMessage()
		if err != nil {
			// If stdin is closed (browser disconnected), getMessage will return error
			// or if it's an EOF, we should exit.
			if err == io.EOF {
				return // Exit gracefully
			}
			// Log other errors to stderr for debugging
			fmt.Fprintf(os.Stderr, "Daemon error reading message: %v\n", err)
			sendMessage(MessageToExtension{Status: "error", Message: fmt.Sprintf("Daemon internal error: %v", err)})
			continue // Try to read next message
		}

		if message.Filename == "" || message.FullDestinationPath == "" {
			sendMessage(MessageToExtension{Status: "error", Message: "Invalid message format: filename or fullDestinationPath missing"})
			continue
		}

		response := waitForFileAndMove(message.Filename, message.FullDestinationPath)
		if err := sendMessage(response); err != nil {
			fmt.Fprintf(os.Stderr, "Daemon error sending response: %v\n", err)
		}
	}
}