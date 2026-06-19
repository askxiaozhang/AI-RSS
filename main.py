import sys
import uvicorn

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "worker":
        print("Starting background worker (arq)...")
        import subprocess
        # Run arq worker src.tasks.worker.WorkerSettings
        subprocess.run(["arq", "src.tasks.worker.WorkerSettings"])
    else:
        print("Starting FastAPI web server...")
        uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    main()
