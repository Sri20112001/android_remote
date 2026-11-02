package ws

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"github.com/tuf-remote/agent/internal/constants"
	"github.com/tuf-remote/agent/internal/middleware"
)

// CommandError is an error returned by a command handler with a specific error code.
type CommandError struct {
	Code    constants.ErrorCode
	Message string
}

func (e *CommandError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// NewCommandError constructs a CommandError.
func NewCommandError(code constants.ErrorCode, message string) *CommandError {
	return &CommandError{Code: code, Message: message}
}

// HandlerFunc handles a WebSocket command frame.
type HandlerFunc func(ctx context.Context, id middleware.Identity, payload json.RawMessage) (any, error)

// Registry maps (module, action) to their respective command handlers.
type Registry struct {
	mu       sync.RWMutex
	handlers map[string]HandlerFunc
}

// NewRegistry constructs a new command registry.
func NewRegistry() *Registry {
	return &Registry{
		handlers: make(map[string]HandlerFunc),
	}
}

func makeKey(module, action string) string {
	return module + ":" + action
}

// Register binds a handler function to a (module, action) pair.
func (r *Registry) Register(module, action string, handler HandlerFunc) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[makeKey(module, action)] = handler
}

// Dispatch executes the registered handler for a command frame and returns the response frame.
func (r *Registry) Dispatch(ctx context.Context, id middleware.Identity, req *Frame) *Frame {
	if req.ID == "" {
		return NewProtocolErrorFrame(constants.CodeInvalidRequest, "command frame must include an id")
	}
	if req.Module == "" || req.Action == "" {
		return NewResponseError(req.ID, constants.CodeInvalidRequest, "command requires module and action")
	}

	key := makeKey(req.Module, req.Action)
	r.mu.RLock()
	handler, ok := r.handlers[key]
	r.mu.RUnlock()

	if !ok {
		return NewResponseError(req.ID, constants.CodeUnsupported, fmt.Sprintf("action '%s.%s' is not supported", req.Module, req.Action))
	}

	res, err := handler(ctx, id, req.Payload)
	if err != nil {
		var cmdErr *CommandError
		if errors.As(err, &cmdErr) {
			return NewResponseError(req.ID, cmdErr.Code, cmdErr.Message)
		}
		return NewResponseError(req.ID, constants.CodeInternal, "internal server error")
	}

	if res == nil {
		return nil
	}

	return NewResponseSuccess(req.ID, res)
}

