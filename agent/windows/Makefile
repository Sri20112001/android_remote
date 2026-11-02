# TUF Remote agent — build/test entry points.
# On Windows prefer scripts\*.ps1 (PowerShell); these targets assume a
# POSIX-like shell (Git Bash, WSL, CI).

GO      ?= go
GOOS    ?= windows
GOARCH  ?= amd64
BIN     ?= bin/tuf-remote-agent.exe

.PHONY: fmt fmt-check vet test build run clean verify

fmt:
	gofmt -w .

fmt-check:
	@out=$$(gofmt -l .); if [ -n "$$out" ]; then echo "gofmt needed on:"; echo "$$out"; exit 1; fi

vet:
	$(GO) vet ./...

test:
	$(GO) test ./...

build:
	GOOS=$(GOOS) GOARCH=$(GOARCH) $(GO) build -ldflags "-s -w" -o $(BIN) ./cmd/agent

run:
	$(GO) run ./cmd/agent

# Full verification gate: formatting, static analysis, tests.
verify: fmt-check vet test

clean:
	rm -rf bin data
